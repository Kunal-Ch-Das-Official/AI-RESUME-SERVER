export interface PricingPlan {
  id: string;
  name: string;
  price: number; // in INR
  priceInPaise: number; // in Paise (price * 100)
  resumes: number; // total credits granted
  validity: string;
  description: string;
  features: readonly string[];
  isPopular?: boolean;
}

export const PRICING_PLANS = {
  plan_free: {
    id: "plan_free",
    name: "Free",
    price: 0,
    priceInPaise: 0,
    resumes: 0,
    validity: "Lifetime",
    description: "Unlimited draft / 0 paid AI credits",
    features: [
      "Unlimited manual draft editing",
      "Standard PDF download",
      "Basic resume templates",
      "0 paid AI credits",
    ],
  },
  plan_starter_4: {
    id: "plan_starter_4",
    name: "Starter",
    price: 99,
    priceInPaise: 9900,
    resumes: 4,
    validity: "6 Months",
    description: "Essential package for active job seekers",
    features: [
      "4 AI-generated resumes",
      "6 months validity",
      "ATS keyword optimizer",
      "All premium templates",
    ],
  },
  plan_pro_10: {
    id: "plan_pro_10",
    name: "Career Pro",
    price: 199,
    priceInPaise: 19900,
    resumes: 10,
    validity: "1 Year",
    description: "Best value for career transitions & tailored applications",
    features: [
      "10 AI-generated resumes",
      "1 year validity",
      "ATS score & tailoring engine",
      "All premium templates + cover letter",
      "Priority customer support",
    ],
    isPopular: true,
  },
  plan_ultimate_20: {
    id: "plan_ultimate_20",
    name: "Ultimate",
    price: 349,
    priceInPaise: 34900,
    resumes: 20,
    validity: "Lifetime",
    description: "Complete career companion with lifetime access",
    features: [
      "20 AI-generated resumes",
      "Lifetime validity",
      "Unlimited revisions & tailoring",
      "Complete template suite",
      "Direct recruiter format export",
    ],
  },
} as const;

export type PlanId = keyof typeof PRICING_PLANS;

export const getPlanById = (planId: string): PricingPlan | null => {
  return (PRICING_PLANS as Record<string, PricingPlan>)[planId] || null;
};
