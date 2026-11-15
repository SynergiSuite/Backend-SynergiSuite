export class VerificationResponseDto {
  user_id?: number;
  name?: string;
  email?: string;
  access_token?: string;
  isVerified?: boolean;
}

export class LoginResponseDto {
  user_id: number;
  access_token: string;
  email: string;
  name: string;
  verified: boolean;
  business: boolean;
  business_id?: number;
  business_name?: string;
  role?: any;
}

export class EmailVerificationResponse {
  message: string;
  isVerified: boolean;
}
