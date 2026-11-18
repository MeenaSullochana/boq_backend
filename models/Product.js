import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specification: { type: String, default: '' },
    brand: { type: String, default: '' },
    unit: { type: String, default: 'Nos' },
    /**
     * inherit = use linked category formula
     * none / W_H / W_D / W_H_D = product-level override
     */
    formulaType: {
      type: String,
      enum: ['inherit', 'none', 'W_H', 'W_D', 'W_H_D'],
      default: 'inherit',
    },
    rate: { type: Number, required: true, default: 0 },
    image: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    childCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    remarks: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', specification: 'text', brand: 'text' });

export default mongoose.model('Product', productSchema);
