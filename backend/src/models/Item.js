import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: {
        values: [
          'Books',
          'Calculators',
          'Lab Equipment',
          'Sports Gear',
          'Electronics',
          'Hostel Essentials',
          'Others',
        ],
        message: '{VALUE} is not a valid category',
      },
    },
    images: {
      type: [String],
      required: [true, 'Please upload at least one image'],
      validate: {
        validator: function (val) {
          return val.length > 0;
        },
        message: 'An item must have at least one image.',
      },
    },
    rentalFee: {
      type: Number,
      required: [true, 'Please add a rental fee'],
      min: [0, 'Rental fee cannot be negative'],
      default: 0,
    },
    securityDeposit: {
      type: Number,
      required: [true, 'Please add a security deposit'],
      min: [0, 'Security deposit cannot be negative'],
      default: 0,
    },
    availability: {
      type: Boolean,
      default: true,
    },
    location: {
      type: String,
      required: [true, 'Please add a location/hostel room number'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for text search
itemSchema.index({ title: 'text', description: 'text', location: 'text' });

const Item = mongoose.model('Item', itemSchema);

export default Item;
