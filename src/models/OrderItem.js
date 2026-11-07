import mongoose from 'mongoose';
import { orderItemSchema } from './Order.js';

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
