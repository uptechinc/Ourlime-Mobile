

export type JobType = {
    id: string;
    jobCategory: string;
};

export type Job = {
    id: string;
    title: string;
    company: string;
    location: string;
    salaryRange: string;
    type: JobType;
    skills: string[];
    postedDate: string;
    logo: string;
}

export type ProfessionalJob = {
    id: string;
    jobTitle: string;
    jobDescription: string;
    userId: string;
    jobId: string;
    company: {
        name: string;
        logo: string;
    };
    requirements: {
        id: string;
        description: string[];
    };
    skills: {
        id: string;
        skillsNeeded: string[];
    };
    qualifications: {
        id: string;
        qualificationsNeeded: string[];
    };
    questions: Array<{
        id: string;
        question: string;
        answerType: 'text' | 'multiple' | 'single';
        answerOptions?: string[];
    }>;
    createdAt: string;
    location: string;
    priceRange: {
        from: string;
        to: string;
    };
    type: 'Full-time' | 'Part-time' | 'Contract';
    userImage: string | null;
    userName: string;
};

export type QuickTask = {
    id: string;
    jobTitle: string;
    jobDescription: string;
    userId: string;
    jobId: string;
    requirements: {
        id: string;
        description: string[];
    };
    skills: {
        id: string;
        skillsNeeded: string[];
    };
    budget: string;
    duration: string;
    location: string;
    createdAt: string;
    taskProvider: {
        name: string;
        avatar: string;
        rating: number;
        tasksCompleted: number;
    };
    priceRange: {
        from: string;
        to: string;
    };
};

export type FreelanceProject = {
    id: string;
    jobTitle: string;
    jobDescription: string;
    userId: string;
    jobId: string;
    requirements: {
        id: string;
        description: string[];
    };
    skills: {
        id: string;
        skillsNeeded: string[];
    };
    qualifications: {
        id: string;
        qualificationsNeeded: string[];
    };
    budget: {
        range: string;
        type: 'Fixed' | 'Hourly';
    };
    duration: string;
    clientInfo: {
        name: string;
        avatar: string;
        rating: number;
        projectsPosted: number;
        successRate: number;
    };
    proposalCount: number;
    deadline: string;
    createdAt: string;
    priceRange: {
        from: string;
        to: string;
    };
};