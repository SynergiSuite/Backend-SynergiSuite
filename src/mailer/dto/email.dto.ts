export class EmailDto {
  sender?: string;
  to: string;
  subject: string;
  text: string;
  name: string;
  heading: string;
  invited_by?: string;
  invited_bys_role?: string;
  business?: string;
}
