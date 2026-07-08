import Item from '../models/Item.js';
import Request from '../models/Request.js';
import Wishlist from '../models/Wishlist.js';
import Notification from '../models/Notification.js';
import cloudinary from '../config/cloudinary.js';
import { emitAvailabilityUpdate, emitNotification } from '../utils/socket.js';

// Helper to upload image to Cloudinary
const uploadToCloudinary = async (imageStr) => {
  try {
    // If it's not base64 or doesn't look like file data, return as-is
    if (!imageStr.startsWith('data:image')) {
      return imageStr;
    }

    const uploadResponse = await cloudinary.uploader.upload(imageStr, {
      folder: 'campushare_items',
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error, using local fallback:', error.message);
    // If upload fails (e.g., due to invalid credentials), return a placeholder or raw string
    return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600';
  }
};

// @desc    Add a new item
// @route   POST /api/items
// @access  Private
export const addItem = async (req, res, next) => {
  try {
    const { title, description, category, images, rentalFee, securityDeposit, location } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one image' });
    }

    // Process all images
    const uploadedImages = [];
    for (const img of images) {
      const url = await uploadToCloudinary(img);
      uploadedImages.push(url);
    }

    const item = await Item.create({
      owner: req.user._id,
      title,
      description,
      category,
      images: uploadedImages,
      rentalFee: Number(rentalFee) || 0,
      securityDeposit: Number(securityDeposit) || 0,
      location,
    });

    // Notify users who have match wishlist alert criteria (Wishlist matches)
    const matchingWishlists = await Wishlist.find({
      $or: [
        { alertCategories: category },
        { alertKeywords: { $in: title.toLowerCase().split(' ') } }
      ]
    }).populate('user');

    for (const wl of matchingWishlists) {
      if (wl.user._id.toString() !== req.user._id.toString()) {
        const notifMsg = `A new item "${title}" matching your wishlist has been listed in "${category}"!`;
        
        // Create DB notification
        await Notification.create({
          recipient: wl.user._id,
          sender: req.user._id,
          type: 'wishlist_alert',
          message: notifMsg,
          link: `/items/${item._id}`,
        });

        // Real-time emit
        emitNotification(wl.user._id, 'wishlist_alert', {
          message: notifMsg,
          itemId: item._id,
          title,
        });
      }
    }

    res.status(201).json({
      success: true,
      item,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all items with search, category filters, and pagination
// @route   GET /api/items
// @access  Public
export const getItems = async (req, res, next) => {
  try {
    const { search, category, minFee, maxFee, page = 1, limit = 12 } = req.query;

    const query = { availability: true };

    // Search query
    if (search) {
      query.$text = { $search: search };
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Rental fee range filter
    if (minFee || maxFee) {
      query.rentalFee = {};
      if (minFee) query.rentalFee.$gte = Number(minFee);
      if (maxFee) query.rentalFee.$lte = Number(maxFee);
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch matching items
    const items = await Item.find(query)
      .populate('owner', 'name avatar trustScore')
      .sort(search ? { score: { $meta: 'textScore' } } : '-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Item.countDocuments(query);

    res.status(200).json({
      success: true,
      count: items.length,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      items,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get item details by ID
// @route   GET /api/items/:id
// @access  Public
export const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).populate('owner', 'name email department semester avatar trustScore');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private (Owner only)
export const updateItem = async (req, res, next) => {
  try {
    let item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Verify ownership
    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this item' });
    }

    const { title, description, category, images, rentalFee, securityDeposit, location, availability } = req.body;

    const updates = {
      title,
      description,
      category,
      location,
      availability,
    };

    if (rentalFee !== undefined) updates.rentalFee = Number(rentalFee);
    if (securityDeposit !== undefined) updates.securityDeposit = Number(securityDeposit);

    // Process images if updating
    if (images && Array.isArray(images) && images.length > 0) {
      const uploadedImages = [];
      for (const img of images) {
        const url = await uploadToCloudinary(img);
        uploadedImages.push(url);
      }
      updates.images = uploadedImages;
    }

    item = await Item.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    // Broadcast update via socket
    if (availability !== undefined) {
      emitAvailabilityUpdate(item._id, availability);
    }

    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private (Owner only)
export const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Verify ownership
    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    // Check if the item is currently borrowed
    const activeBorrowings = await Request.findOne({
      item: item._id,
      status: { $in: ['paid', 'handover_pending', 'borrowed', 'return_pending'] },
    });

    if (activeBorrowings) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete item. It is currently involved in an active borrowing process.',
      });
    }

    await Item.findByIdAndDelete(req.params.id);

    // Broadcast unavailability
    emitAvailabilityUpdate(item._id, false);

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
