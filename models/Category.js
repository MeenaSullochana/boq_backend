import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['category', 'subcategory', 'child'],
      required: true,
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String, default: '' },
    /** BOQ qty formula: none | W_H | W_D | W_H_D */
    formulaType: {
      type: String,
      enum: ['none', 'W_H', 'W_D', 'W_H_D'],
      default: 'none',
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, type: 1, parent: 1 });

export default mongoose.model('Category', categorySchema);
