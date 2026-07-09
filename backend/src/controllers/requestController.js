import crypto from 'crypto';
import Request from '../models/Request.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitNotification, emitAvailabilityUpdate } from '../utils/socket.js';

// @desc    Create a borrow request
// @route   POST /api/requests
// @access  Private
export const createRequest = async (req, res, next) => {
  try {
    const { itemId, duration } = req.body;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (!item.availability) {
      return res.status(400).json({ success: false, message: 'Item is not currently available for lending' });
    }

    if (item.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot borrow your own item' });
    }

    // Check if there is already an active or pending request by this borrower for this item
    const existingRequest = await Request.findOne({
      item: itemId,
      borrower: req.user._id,
      status: { $in: ['pending', 'approved', 'payment_pending', 'paid', 'handover_pending', 'borrowed'] },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active or pending request for this item',
      });
    }

    // Create the request
    const request = await Request.create({
      item: itemId,
      borrower: req.user._id,
      lender: item.owner,
      duration: Number(duration),
      status: 'pending',
    });

    // Notify lender in DB
    const notifMsg = `${req.user.name} has requested to borrow your item: "${item.title}".`;
    await Notification.create({
      recipient: item.owner,
      sender: req.user._id,
      type: 'request_received',
      message: notifMsg,
      link: `/requests`,
    });

    // Real-time socket notification
    emitNotification(item.owner, 'request_received', {
      message: notifMsg,
      requestId: request._id,
      itemName: item.title,
    });

    res.status(201).json({
      success: true,
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept or Reject a borrow request
// @route   PUT /api/requests/:id/respond
// @access  Private (Lender only)
export const respondToRequest = async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const request = await Request.findById(req.params.id).populate('item').populate('borrower');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Check ownership
    if (request.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already in ${request.status} status` });
    }

    if (action === 'approve') {
      // If item has a rental fee or security deposit, require payment
      if (request.item.rentalFee > 0 || request.item.securityDeposit > 0) {
        request.status = 'payment_pending';
      } else {
        // Free item, proceed directly to handover pending
        request.status = 'handover_pending';
        // Generate handover code
        request.handoverCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 character code
      }

      // Notify borrower
      const notifMsg = `Your request for "${request.item.title}" was approved by the lender! Please proceed to the next step.`;
      await Notification.create({
        recipient: request.borrower._id,
        sender: req.user._id,
        type: 'request_approved',
        message: notifMsg,
        link: `/requests`,
      });
      emitNotification(request.borrower._id, 'request_approved', {
        message: notifMsg,
        requestId: request._id,
        status: request.status,
      });

    } else if (action === 'reject') {
      request.status = 'rejected';

      // Notify borrower
      const notifMsg = `Your request for "${request.item.title}" was declined by the lender.`;
      await Notification.create({
        recipient: request.borrower._id,
        sender: req.user._id,
        type: 'request_rejected',
        message: notifMsg,
        link: `/requests`,
      });
      emitNotification(request.borrower._id, 'request_rejected', {
        message: notifMsg,
        requestId: request._id,
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use approve or reject' });
    }

    await request.save();

    res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scan and Verify Handover QR
// @route   POST /api/requests/:id/handover
// @access  Private (Borrower only, verifying lender's QR code)
export const verifyHandover = async (req, res, next) => {
  try {
    const { handoverCode } = req.body;
    const request = await Request.findById(req.params.id).populate('item').populate('lender').populate('borrower');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Handover scanner is the Borrower, who scans the Lender's code
    if (request.borrower._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the borrower can scan the handover QR' });
    }

    if (request.status !== 'handover_pending') {
      return res.status(400).json({
        success: false,
        message: `Handover cannot be completed. Request status is: ${request.status}`,
      });
    }

    if (request.handoverCode !== handoverCode) {
      return res.status(400).json({ success: false, message: 'Invalid Handover QR Code or PIN' });
    }

    // Set request status to borrowed and update dates
    request.status = 'borrowed';
    request.dueDate = new Date(Date.now() + request.duration * 24 * 60 * 60 * 1000);
    await request.save();

    // Mark item unavailable
    const item = await Item.findById(request.item._id);
    item.availability = false;
    await item.save();

    // Broadcast item availability update
    emitAvailabilityUpdate(item._id, false);

    // Notify lender that item is successfully handed over
    const notifMsg = `Handover complete! "${item.title}" is now marked as active borrowing. Due date: ${request.dueDate.toLocaleDateString()}`;
    await Notification.create({
      recipient: request.lender._id,
      sender: req.user._id,
      type: 'item_handover',
      message: notifMsg,
      link: `/requests`,
    });
    emitNotification(request.lender._id, 'item_handover', {
      message: notifMsg,
      requestId: request._id,
    });

    res.status(200).json({
      success: true,
      message: 'Item handover successfully verified. Happy borrowing!',
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate Return Request
// @route   POST /api/requests/:id/return-request
// @access  Private (Borrower only)
export const requestReturn = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id).populate('item');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.borrower.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the borrower can initiate returns' });
    }

    if (request.status !== 'borrowed') {
      return res.status(400).json({ success: false, message: 'Only active borrowed items can be returned' });
    }

    // Generate Return code
    request.status = 'return_pending';
    request.returnCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 digit PIN
    await request.save();

    // Notify Lender
    const notifMsg = `${req.user.name} wants to return your item: "${request.item.title}". Please scan their QR to accept return.`;
    await Notification.create({
      recipient: request.lender,
      sender: req.user._id,
      type: 'item_returned',
      message: notifMsg,
      link: `/requests`,
    });
    emitNotification(request.lender, 'item_returned', {
      message: notifMsg,
      requestId: request._id,
      status: request.status,
    });

    res.status(200).json({
      success: true,
      message: 'Return request created. Please show the Return QR/PIN to the lender.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scan and Verify Return QR
// @route   POST /api/requests/:id/return-verify
// @access  Private (Lender only, scanning borrower's return QR)
export const verifyReturn = async (req, res, next) => {
  try {
    const { returnCode } = req.body;
    const request = await Request.findById(req.params.id).populate('item').populate('borrower').populate('lender');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Return scanner is the Lender, who scans the Borrower's code
    if (request.lender._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the lender can verify and scan the return' });
    }

    if (request.status !== 'return_pending') {
      return res.status(400).json({ success: false, message: 'Request is not in return_pending status' });
    }

    if (request.returnCode !== returnCode) {
      return res.status(400).json({ success: false, message: 'Invalid Return QR Code or PIN' });
    }

    // Update Request status to returned
    request.status = 'returned';
    request.actualReturnDate = new Date();
    await request.save();

    // Make item available again
    const item = await Item.findById(request.item._id);
    item.availability = true;
    await item.save();

    // Broadcast item availability update
    emitAvailabilityUpdate(item._id, true);

    // Trust Score Calculations & Share Points Adjustments
    const borrower = await User.findById(request.borrower._id);
    const lender = await User.findById(request.lender._id);

    const isLate = new Date() > new Date(request.dueDate);
    let trustScoreDiff = 0;
    let borrowerPointsDiff = 0;
    let lenderPointsDiff = 0;

    if (isLate) {
      // Late return: deduct trust score and penalize points
      trustScoreDiff = -15;
      borrowerPointsDiff = -20;
      lenderPointsDiff = 50 + (item.rentalFee * request.duration); // Lender still gets rental points
      
      borrower.trustScore = Math.max(0, borrower.trustScore + trustScoreDiff);
      borrower.sharePoints = Math.max(0, borrower.sharePoints + borrowerPointsDiff);
    } else {
      // Successful on-time return: increase trust score and reward points
      trustScoreDiff = 5;
      borrowerPointsDiff = 20; // reward for safe return
      lenderPointsDiff = 50 + (item.rentalFee * request.duration); // reward for sharing

      borrower.trustScore = Math.min(100, borrower.trustScore + trustScoreDiff);
      borrower.sharePoints += borrowerPointsDiff;
    }

    // Lender gets points for sharing
    lender.sharePoints += lenderPointsDiff;

    await borrower.save();
    await lender.save();

    // Create DB notifications for both
    const borrowerMsg = `Return complete! Your trust score is now ${borrower.trustScore} (${trustScoreDiff >= 0 ? '+' : ''}${trustScoreDiff}) and you received/lost ${borrowerPointsDiff} share points.`;
    await Notification.create({
      recipient: borrower._id,
      sender: req.user._id,
      type: 'item_returned',
      message: borrowerMsg,
      link: `/profile`,
    });
    emitNotification(borrower._id, 'item_returned', { message: borrowerMsg });

    const lenderMsg = `Return confirmed! You earned ${lenderPointsDiff} share points for lending "${item.title}".`;
    await Notification.create({
      recipient: lender._id,
      sender: req.user._id,
      type: 'item_returned',
      message: lenderMsg,
      link: `/profile`,
    });
    emitNotification(lender._id, 'item_returned', { message: lenderMsg });

    res.status(200).json({
      success: true,
      message: 'Item return verified successfully. Trust scores and share points updated.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    File a complaint against a transaction
// @route   POST /api/requests/:id/complain
// @access  Private
export const fileComplaint = async (req, res, next) => {
  try {
    const { reason, targetUserId } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Verify user is part of the request
    if (
      request.borrower.toString() !== req.user._id.toString() &&
      request.lender.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to file a complaint for this transaction' });
    }

    // Deduct trust score of target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    targetUser.trustScore = Math.max(0, targetUser.trustScore - 20); // Severe penalty for complaint
    await targetUser.save();

    // Create notification
    const complaintMsg = `A complaint was filed against you. Your trust score has been reduced to ${targetUser.trustScore}. Reason: ${reason}`;
    await Notification.create({
      recipient: targetUser._id,
      sender: req.user._id,
      type: 'request_rejected', // reuse request rejected for warning alert
      message: complaintMsg,
      link: `/profile`,
    });
    emitNotification(targetUser._id, 'complaint_alert', { message: complaintMsg });

    res.status(200).json({
      success: true,
      message: 'Complaint successfully registered. Trust score updated.',
    });
  } catch (error) {
    next(error);
  }
};
