import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', 'uploads');

export function resolveUploadPath(imagePath) {
  if (!imagePath) return null;
  const clean = String(imagePath).replace(/^\/+/, '').replace(/^uploads\//, '');
  const full = path.join(uploadsRoot, path.basename(clean));
  if (fs.existsSync(full)) return full;
  const alt = path.join(uploadsRoot, clean);
  if (fs.existsSync(alt)) return alt;
  return null;
}
