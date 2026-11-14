/**
 * Sets category.formulaType from formula-sheet naming rules when still default "none".
 * Run: node scripts/sync-category-formulas.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { inferFormulaType } from '../utils/boqFormula.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find({ type: 'category' });
  let updated = 0;
  for (const cat of cats) {
    const inferred = inferFormulaType(cat.name);
    if (inferred === 'none') continue;
    if (cat.formulaType === inferred) continue;
    // Only auto-fill when still default none
    if (cat.formulaType && cat.formulaType !== 'none') continue;
    cat.formulaType = inferred;
    await cat.save();
    updated += 1;
    console.log(`${cat.code || '-'} ${cat.name} → ${inferred}`);
  }
  console.log(`Updated ${updated} categories`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
