/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IBasicInfo {
  fullName: string;
  position: string;
}

export interface IAddress {
  streetName: string;
  city: string;
  district: string;
  pincode: string;
  country: string;
}

export interface IContactInfo {
  primaryEmail: string;
  primaryMobile: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  [key: string]: any;
}

export interface IProfileSummary {
  priority: number;
  subject: string;
  objective?: string;
}

export interface IProjects {
  priority: number;
  sectionTitle?: string;
  projects: {
    [projectName: string]: {
      priority: number;
      description: string;
      projectUrl?: string;
      startDate: string | Date;
      endDate?: string | Date;
      isWorking: boolean;
      techStack: string[];
      skills: string[];
      [key: string]: any;
    };
  };
}

export interface IEducations {
  priority: number;
  sectionTitle?: string;
  qualifications: {
    [degreeName: string]: {
      priority: number;
      institutionName: string;
      startedAt: string | Date;
      yearOfComplete?: string | Date;
      pursuing: boolean;
      achivedMarks?: number;
      totalMarks?: number;
      percentage?: string;
      description?: string;
      [key: string]: any;
    };
  };
}

export interface IWorkExperience {
  priority: number;
  sectionTitle?: string;
  companies: {
    [companyNames: string]: {
      priority: number;
      jobTitle: string;
      jobConditions: "WFO" | "WFH" | "REMOTE" | string;
      jobTypes:
        | "FULL_TIME"
        | "PART_TIME"
        | "FREELANCING"
        | "SELF_EMPLOYED"
        | string;
      jobLocation?: string;
      responsibility?: string[];
      startDate: Date | string;
      endDate?: string | Date;
      isPresentJob: boolean;
      [key: string]: any;
    };
  };
}

export interface ISkillSet {
  priority: number;
  sectionTitle?: string;
  skills: {
    [category: string]: string[];
  };
}

export interface ICertificates {
  priority: number;
  sectionTitle?: string;

  certificates: {
    [certificateName: string]: {
      priority: number;
      overview?: string;
      skillLearned: string[];
      certificateUrl?: string;
      certificateContent?: {
        title: string;
        url: string;
        key: string;
      };
      duration: string;
    };
  };
}

export interface IPublications {
  priority: number;
  sectionTitle?: string;
  publications: {
    [title: string]: {
      priority: number;
      description?: string;
      referenceUrl?: string;
      publicationReference?: {
        title: string;
        accessUrl: {
          url: string;
          key: string;
        };
      }[];
    };
  };
}


export interface IAwardsAndAchievements {
  priority: number;
  sectionTitle?: string;
  achievements: {
    priority: number;
    title?: string;
    description?: string;
    url?: string;
    documents?: {
      title: string;
      accessUrl: {
        url: string;
        key: string;
      };
    }[];
  };
}


export interface IHobbies {
  priority: number;
  sectionTitle?: string;
  [hobbyName: string]: any;
}

export interface ILanguageProficiency {
  priority: number;
  sectionTitle?: string;
  languageKnows: {
    languageName: string;
    proficiencyOutOfTen: number;
  }[];
}

export interface IOpenSource {
  priority: number;
  sectionTitle?: string;

  contributions: {
    [projectName: string]: {
      priority: number;
      githubUrl?: string;
      description?: string;
      duration?: string;
    };
  };
}


export interface IResumeInfo {
  basicInfo: IBasicInfo;
  avatar?: {
    url: string;
    key: string;
  };
  address: IAddress;
  contactInfo: IContactInfo;
  profileSummary: IProfileSummary;
  educations: IEducations;
  workExperience?: IWorkExperience;
  skills: ISkillSet;
  languageProficiency: ILanguageProficiency;
  hobbies?: IHobbies;
  projects?: IProjects;
  certifications?: ICertificates;
  openSource?: IOpenSource;
  publications?: IPublications;
  awardsAndAchievements?: IAwardsAndAchievements;
  templateName: string;
}
