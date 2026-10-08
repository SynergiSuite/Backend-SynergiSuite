export class BusinessCreationResponse {
  business_id: number;
  business_name: string;
  // Change later on
  role: any;
}

export class BusinessInvitationAcceptanceResponse {
  business_id: number;
  business_name: string;
  role_id: number;
  role_name: string;
  // Change
  role: any;
  client_id: number | null;
}

export class EmployeeDetailResponse {
  employee: {
    userId: number;
    name: string;
    email: string;
    salary: number;
    registrationDate: Date;
    role: any;
    business: {
      businessId: number;
      name: string;
    };
  };
  teams: any[];
  taskActivity: any;
  recentActivities: any;
}

export class EmployeesResponse {
  data: any[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    currentPage: number;
    totalPages: number;
  };
  statistics: {
    registrationCount: number;
    projectCount: number;
    newProjectsThisMonth: number;
  };
}

export class AllEmployeeResponse {
  data: any;
}
