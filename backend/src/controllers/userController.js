import User from '../models/User.js';
import Request from '../models/Request.js';

// @desc    Update user profile details
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { department, semester, avatar } = req.body;

    const fieldsToUpdate = {};
    if (department) fieldsToUpdate.department = department;
    if (semester) fieldsToUpdate.semester = semester;
    if (avatar) fieldsToUpdate.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lending and borrowing history
// @route   GET /api/users/history
// @access  Private
export const getUserHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Lending History: Requests where this user is the lender
    const lendingHistory = await Request.find({ lender: userId })
      .populate('item')
      .populate('borrower', 'name email department semester avatar trustScore')
      .sort('-createdAt');

    // 2. Borrowing History: Requests where this user is the borrower
    const borrowingHistory = await Request.find({ borrower: userId })
      .populate('item')
      .populate('lender', 'name email department semester avatar trustScore')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      lending: lendingHistory,
      borrowing: borrowingHistory,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user notifications
// @route   GET /api/users/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Request.db.model('Notification')
      .find({ recipient: req.user._id })
      .populate('sender', 'name avatar')
      .sort('-createdAt')
      .limit(50);

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/users/notifications/read
// @access  Private
export const markNotificationsRead = async (req, res, next) => {
  try {
    await Request.db.model('Notification').updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};
