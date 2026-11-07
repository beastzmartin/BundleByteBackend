import Coupon from '../models/Coupon.js';
import { logAudit } from '../middleware/audit.js';

export const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal = 0 } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide a coupon code' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code' });
    }

    const check = coupon.isValid(Number(subtotal));
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (Number(subtotal) * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, Number(subtotal));
    }

    discountAmount = parseFloat(discountAmount.toFixed(2));

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully!',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: coupons.length, coupons });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      code: req.body.code.toUpperCase().trim(),
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'COUPON_CREATED',
      entity: 'Coupon',
      entityId: coupon._id.toString(),
      details: { code: coupon.code, discountValue: coupon.discountValue },
      req,
    });

    res.status(201).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    await coupon.deleteOne();
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    next(error);
  }
};

