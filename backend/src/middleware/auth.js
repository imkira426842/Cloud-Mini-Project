import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id name email preferences');
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}
