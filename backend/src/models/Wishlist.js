import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One wishlist profile per user
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
      },
    ],
    alertCategories: [
      {
        type: String,
        enum: [
          'Books',
          'Calculators',
          'Lab Equipment',
          'Sports Gear',
          'Electronics',
          'Hostel Essentials',
          'Others',
        ],
      },
    ],
    alertKeywords: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;
