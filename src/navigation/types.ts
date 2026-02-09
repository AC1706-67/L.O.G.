// Navigation types for the LOG Peer Recovery System

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ConsentWorkflow: {
    participantId: string;
    participantName: string;
    dateOfBirth: Date;
    onComplete: () => void;
  };
  ConsentForm: {
    participantId: string;
    participantName: string;
    dateOfBirth: Date;
    consentForm: any;
    onComplete: () => void;
  };
  ConsentStatus: {
    participantId: string;
    participantName: string;
  };
  IntakeSession: {
    participantId: string;
    participantName: string;
    intakeId?: string;
    onComplete?: () => void;
  };
  IntakeForm: {
    intakeId: string;
    participantId: string;
    section: string;
    onSectionComplete: () => void;
  };
  InteractionLog: {
    participantId: string;
    participantName: string;
    mode: 'quick' | 'session';
  };
  InteractionHistory: {
    participantId: string;
    participantName: string;
  };
  InteractionDetail: {
    interactionId: string;
    participantId: string;
    participantName: string;
  };
  RecoveryPlan: {
    participantId: string;
    participantName: string;
    planId?: string;
  };
  CreateGoal: {
    planId: string;
    participantId: string;
    participantName: string;
    onGoalCreated: () => void;
  };
  GoalDetail: {
    goalId: string;
    planId: string;
    participantId: string;
    participantName: string;
    onGoalUpdated: () => void;
  };
  GoalTracking: {
    planId: string;
    participantId: string;
    participantName: string;
  };
};

export type AuthStackParamList = {
  Login: undefined;
  MFAVerification: { userId: string };
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Participants: undefined;
  Assessments: undefined;
  Plans: undefined;
  More: undefined;
};

export type DrawerParamList = {
  Home: undefined;
  Settings: undefined;
  Profile: undefined;
  Help: undefined;
  Logout: undefined;
};
