import Wishlist from '../models/Wishlist.js';
import Item from '../models/Item.js';

// @desc    Get user's wishlist and alert settings
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
      path: 'items',
      populate: { path: 'owner', select: 'name avatar trustScore' }
    });

    // If wishlist doesn't exist, create it
    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user._id,
        items: [],
        alertCategories: [],
        alertKeywords: [],
      });
    }

    res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to wishlist
// @route   POST /api/wishlist/toggle/:itemId
// @access  Private
export const toggleWishlistItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    const index = wishlist.items.indexOf(itemId);
    let isAdded = false;

    if (index === -1) {
      // Add to wishlist
      wishlist.items.push(itemId);
      isAdded = true;
    } else {
      // Remove from wishlist
      wishlist.items.splice(index, 1);
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      isWishlisted: isAdded,
      message: isAdded ? 'Item added to wishlist' : 'Item removed from wishlist',
      itemsCount: wishlist.items.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update wishlist alert preferences (keywords and categories)
// @route   PUT /api/wishlist/alerts
// @access  Private
export const updateAlertPreferences = async (req, res, next) => {
  try {
    const { alertCategories, alertKeywords } = req.body;

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id });
    }

    if (alertCategories !== undefined) {
      wishlist.alertCategories = alertCategories;
    }

    if (alertKeywords !== undefined) {
      // Clean and normalize keywords
      wishlist.alertKeywords = alertKeywords
        .map((kw) => kw.trim().toLowerCase())
        .filter((kw) => kw.length > 0);
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Alert preferences updated successfully',
      alertCategories: wishlist.alertCategories,
      alertKeywords: wishlist.alertKeywords,
    });
  } catch (error) {
    next(error);
  }
};
