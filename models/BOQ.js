import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    categoryLabel: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    specification: { type: String, required: true },
    brand: { type: String, default: '' },
    image: { type: String, default: '' },
    unit: { type: String, default: 'Nos' },
    /** none | W_H | W_D — from formula sheet */
    formulaType: { type: String, enum: ['none', 'W_H', 'W_D'], default: 'none' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    /** Always 1 on BOQ sheet — kept for layout compatibility */
    nos: { type: Number, default: 1 },
    /** User-entered quantity (Amount = quantity × formula × rate) */
    quantity: { type: Number, default: 1 },
    /** Billed qty = quantity × formula area (or quantity if no formula) */
    qty: { type: Number, default: 1 },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    remarks: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isSectionHeader: { type: Boolean, default: false },
  },
  { _id: true }
);

const boqSchema = new mongoose.Schema(
  {
    billNo: { type: String, unique: true },
    title: { type: String, default: 'FESTON INTERIOR WORKS COSTING' },
    clientName: { type: String, required: true },
    location: { type: String, default: '' },
    kindAttn: { type: String, default: '' },
    billDate: { type: Date, default: Date.now },
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalWithoutGst: { type: Number, default: 0 },
    applyGst: { type: Boolean, default: false },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    gstExtra: { type: Boolean, default: false },
    notes: {
      type: [String],
      default: [
        'Final BOQ will be shared after final 3D.',
        'Work Duration 30 Days.',
        'Actuals will be claimed while billing.',
        'AC, and brought out items like sofas, Electrical, Lighting, Painting, Back Light Logo are currently not considered.',
        'PO Compulsory Need From Client Side.',
      ],
    },
    paymentTerms: {
      type: [String],
      default: [
        '3D Design advance 10%',
        'Production Advance 60%',
        'Material reach at site 30%',
        'After completion of work 10%',
      ],
    },
    status: {
      type: String,
      enum: ['draft', 'final', 'sent'],
      default: 'final',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

boqSchema.pre('save', async function assignBillNo() {
  if (this.billNo) return;
  const count = await mongoose.model('BOQ').countDocuments();
  const year = new Date().getFullYear();
  this.billNo = `OI-${year}-${String(count + 1).padStart(4, '0')}`;
});

export default mongoose.model('BOQ', boqSchema);
