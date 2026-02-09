/**
 * Consent Module Types
 * Handles consent capture and management for 42 CFR Part 2 and AI processing
 */

export type ConsentType = 'CFR_PART_2' | 'AI_PROCESSING';
export type ConsentStatus = 'active' | 'expired' | 'revoked';

export interface ConsentData {
  participantId: string;
  consentType: ConsentType;
  participantName: string;
  dateOfBirth: Date;
  purposeOfDisclosure?: string;
  authorizedRecipients?: string[];
  informationToDisclose?: string;
  expirationDate?: Date;
  signature: string; // Base64 encoded signature image
  dateSigned: Date;
  witnessName?: string;
  witnessSignature?: string;
}

export interface ConsentRecord extends ConsentData {
  id: string;
  status: ConsentStatus;
  revokedDate?: Date;
  revokedReason?: string;
  createdAt: Date;
  createdBy: string;
}

export interface ConsentStatusResponse {
  hasCFRConsent: boolean;
  hasAIConsent: boolean;
  cfrExpirationDate?: Date;
  aiConsentDate?: Date;
  canCollectPHI: boolean;
}

export interface ConsentFormSet {
  cfrForm: ConsentForm;
  aiForm: ConsentForm;
}

export interface ConsentForm {
  type: ConsentType;
  title: string;
  sections: ConsentSection[];
}

export interface ConsentSection {
  id: string;
  title: string;
  content: string;
  required: boolean;
}

/**
 * CFR Part 2 Consent Form Schema
 * Requirements: 1.2 - 42 CFR Part 2 consent form fields
 */
export const CFR_PART_2_FORM_SCHEMA: ConsentForm = {
  type: 'CFR_PART_2',
  title: '42 CFR Part 2 Consent for Disclosure',
  sections: [
    {
      id: 'participant_info',
      title: 'Participant Information',
      content: 'This consent form is required under 42 CFR Part 2 federal confidentiality regulations for substance use disorder records.',
      required: true,
    },
    {
      id: 'purpose',
      title: 'Purpose of Disclosure',
      content: 'The purpose of this disclosure is to provide peer recovery support services and coordinate care.',
      required: true,
    },
    {
      id: 'authorized_recipients',
      title: 'Authorized Recipients',
      content: 'Information may be disclosed to authorized peer specialists, supervisors, and healthcare providers involved in your care.',
      required: true,
    },
    {
      id: 'information_disclosed',
      title: 'Information to be Disclosed',
      content: 'This includes substance use disorder treatment records, assessment results, recovery plans, and interaction notes.',
      required: true,
    },
    {
      id: 'expiration',
      title: 'Expiration Date',
      content: 'This consent will expire one year from the date signed, unless revoked earlier.',
      required: true,
    },
    {
      id: 'right_to_revoke',
      title: 'Right to Revoke',
      content: 'You have the right to revoke this consent at any time by providing written notice. Revocation will not affect information already disclosed.',
      required: true,
    },
    {
      id: 're_disclosure',
      title: 'Prohibition on Re-disclosure',
      content: 'This information has been disclosed to you from records protected by Federal confidentiality rules (42 CFR Part 2). The Federal rules prohibit you from making any further disclosure of this information unless further disclosure is expressly permitted by the written consent of the person to whom it pertains or as otherwise permitted by 42 CFR Part 2.',
      required: true,
    },
    {
      id: 'signature',
      title: 'Signature',
      content: 'By signing below, you consent to the disclosure of your substance use disorder treatment records as described above.',
      required: true,
    },
  ],
};

/**
 * AI Consent Form Schema
 * Requirements: 1.4 - AI consent form fields
 */
export const AI_CONSENT_FORM_SCHEMA: ConsentForm = {
  type: 'AI_PROCESSING',
  title: 'Consent for AI-Assisted Data Processing',
  sections: [
    {
      id: 'ai_explanation',
      title: 'AI Usage Explanation',
      content: 'This system uses Amazon Nova AI to assist with conversational data collection, assessment administration, and report generation. The AI helps extract structured information from natural language conversations to reduce data entry burden.',
      required: true,
    },
    {
      id: 'data_protection',
      title: 'Data Protection Assurance',
      content: 'All data processed by AI is encrypted in transit and at rest. AI processing occurs within HIPAA-compliant AWS infrastructure. No data is used to train AI models. All AI interactions are logged for audit purposes.',
      required: true,
    },
    {
      id: 'opt_out',
      title: 'Opt-Out Option',
      content: 'You may decline AI-assisted processing and choose manual data entry instead. This will not affect the quality of services you receive.',
      required: true,
    },
    {
      id: 'signature',
      title: 'Signature',
      content: 'By signing below, you consent to AI-assisted processing of your information as described above.',
      required: true,
    },
  ],
};

/**
 * Coaching Agreement Consent Form Schema
 * Requirements: 1.1 - Coaching agreement consent
 */
export const COACHING_AGREEMENT_FORM_SCHEMA: ConsentForm = {
  type: 'CFR_PART_2', // Uses same type as it's part of enrollment
  title: 'Coaching Agreement',
  sections: [
    {
      id: 'agreement',
      title: 'Coaching Agreement',
      content: 'I agree to participate in peer recovery coaching services. I understand that peer specialists are not licensed therapists or medical professionals, but trained individuals with lived recovery experience.',
      required: true,
    },
    {
      id: 'expectations',
      title: 'Expectations',
      content: 'I understand that coaching involves regular check-ins, goal setting, and support in my recovery journey. I agree to communicate openly and honestly with my peer specialist.',
      required: true,
    },
    {
      id: 'signature',
      title: 'Signature',
      content: 'By signing below, I agree to participate in peer recovery coaching services.',
      required: true,
    },
  ],
};

/**
 * Acknowledgement of Receipt Form Schema
 * Requirements: 1.1 - Acknowledgement of receipt
 */
export const ACKNOWLEDGEMENT_FORM_SCHEMA: ConsentForm = {
  type: 'CFR_PART_2', // Uses same type as it's part of enrollment
  title: 'Acknowledgement of Receipt',
  sections: [
    {
      id: 'bill_of_rights',
      title: 'Bill of Rights',
      content: 'I acknowledge that I have received and reviewed the Participant Bill of Rights.',
      required: true,
    },
    {
      id: 'grievance_procedure',
      title: 'Grievance Procedure',
      content: 'I acknowledge that I have received and reviewed the Grievance Procedure.',
      required: true,
    },
    {
      id: 'ethical_guidelines',
      title: 'Ethical Guidelines',
      content: 'I acknowledge that I have received and reviewed the Ethical Guidelines for Peer Specialists.',
      required: true,
    },
    {
      id: 'signature',
      title: 'Signature',
      content: 'By signing below, I acknowledge receipt of the above documents.',
      required: true,
    },
  ],
};
