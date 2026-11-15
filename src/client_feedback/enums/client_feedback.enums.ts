export enum ClientFeedbackTargetType {
  PROJECT = 'project',
  MILESTONE = 'milestone',
  TASK = 'task',
}

export enum ClientFeedbackType {
  REQUEST = 'request',
  REVIEW = 'review',
  ISSUE = 'issue',
  QUESTION = 'question',
  APPROVAL = 'approval',
  GENERAL = 'general',
}

export enum ClientFeedbackStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}
