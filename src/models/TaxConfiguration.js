import mongoose from 'mongoose';

export const INDIAN_STATES_AND_CODES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

const taxConfigurationSchema = new mongoose.Schema(
  {
    isGstEnabled: {
      type: Boolean,
      default: true,
    },
    businessLegalName: {
      type: String,
      default: 'BundleByte Technologies Private Limited',
      trim: true,
    },
    tradeName: {
      type: String,
      default: 'BundleByte',
      trim: true,
    },
    gstin: {
      type: String,
      default: '29ABCDE1234F1Z5',
      trim: true,
      uppercase: true,
    },
    panNumber: {
      type: String,
      default: 'ABCDE1234F',
      trim: true,
      uppercase: true,
    },
    registeredAddress: {
      street: { type: String, default: '100 Innovation Boulevard, Tech Park' },
      city: { type: String, default: 'Bangalore' },
      state: { type: String, default: 'Karnataka' },
      stateCode: { type: String, default: '29' },
      pincode: { type: String, default: '560001' },
      country: { type: String, default: 'India' },
    },
    businessState: {
      type: String,
      default: 'Karnataka',
    },
    businessStateCode: {
      type: String,
      default: '29',
    },
    defaultGstRate: {
      type: Number,
      default: 18,
      enum: [0, 5, 12, 18, 28],
    },
    taxCalculationMode: {
      type: String,
      enum: ['exclusive', 'inclusive'],
      default: 'exclusive',
    },
    defaultHsnSacCode: {
      type: String,
      default: '998434', // Online text, software, and other downloadable content
      trim: true,
    },
    isCompositionScheme: {
      type: Boolean,
      default: false,
    },
    roundingRule: {
      type: String,
      enum: ['round_half_up', 'round_to_rupee', 'none'],
      default: 'round_half_up',
    },
    invoicePrefix: {
      type: String,
      default: 'INV',
    },
    creditNotePrefix: {
      type: String,
      default: 'CN',
    },
    taxDisclosureNote: {
      type: String,
      default: 'Tax invoice issued under Section 31 of the CGST Act, 2017. All prices displayed are subject to applicable Goods and Services Tax.',
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TaxConfiguration', taxConfigurationSchema);
