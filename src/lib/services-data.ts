/*
  Service data
  ============
  One place holding every service's content. The homepage's service list
  and this file's categories intentionally match - see
  docs/PHASE_0_ARCHITECTURE.md section 18: only publish services after
  the organization verifies them. Everything here is standard home-health
  industry terminology, used as illustrative example content, not a
  factual claim about what Compassionate Care Plus specifically offers.

  Once the organization confirms its real services, this file gets
  replaced with real content - the page components don't need to change,
  only this data.
*/

export interface Service {
  slug: string;
  title: string;
  summary: string;
  whoItMayServe: string[];
  whatToExpect: string[];
  careProcess: { title: string; body: string }[];
  commonQuestions: { q: string; a: string }[];
  relatedSlugs: string[];
}

export const services: Service[] = [
  {
    slug: "skilled-nursing",
    title: "Skilled nursing",
    summary:
      "Clinical care delivered at home by a licensed nurse - wound care, medication management, monitoring and education.",
    whoItMayServe: [
      "People recovering from surgery or a hospital stay",
      "People managing a chronic condition that needs regular clinical monitoring",
      "People who need wound care, injections or infusion therapy at home",
    ],
    whatToExpect: [
      "A nurse visits on a schedule set in the care plan",
      "Vitals, wounds and medications are checked at each visit",
      "The nurse communicates with the physician and the rest of the care team",
    ],
    careProcess: [
      {
        title: "Referral and assessment",
        body: "A nurse reviews the referral and performs an initial in-home assessment.",
      },
      {
        title: "Care plan created",
        body: "Goals, visit frequency and clinical tasks are set with the physician's orders.",
      },
      {
        title: "Ongoing visits",
        body: "The nurse visits as scheduled, documents each visit, and adjusts the plan as needed.",
      },
    ],
    commonQuestions: [
      {
        q: "How often will the nurse visit?",
        a: "Visit frequency depends on the physician's orders and the patient's condition. Specific scheduling will be confirmed during intake.",
      },
      {
        q: "Can a nurse manage medications for me?",
        a: "Medication management is a common part of skilled nursing care. Exact scope will be confirmed with your care team.",
      },
    ],
    relatedSlugs: ["home-health-aide", "medical-social-services"],
  },
  {
    slug: "physical-therapy",
    title: "Physical therapy",
    summary:
      "Regaining strength, balance and mobility at home after an illness, injury or surgery.",
    whoItMayServe: [
      "People recovering from joint replacement or another surgery",
      "People regaining strength and balance after a hospital stay",
      "People at risk of falling who want to move more safely at home",
    ],
    whatToExpect: [
      "A physical therapist evaluates strength, balance and mobility",
      "A home exercise program is built around the patient's actual living space",
      "Progress is tracked and the plan adjusts visit to visit",
    ],
    careProcess: [
      {
        title: "Evaluation",
        body: "The therapist assesses current mobility, strength and fall risk.",
      },
      {
        title: "Plan built",
        body: "Specific, achievable goals are set together with the patient.",
      },
      {
        title: "Therapy visits",
        body: "Regular sessions build strength and confidence moving around the home.",
      },
    ],
    commonQuestions: [
      {
        q: "Do I need special equipment at home?",
        a: "Usually not to start - the therapist works with what's already in the home and can recommend equipment if it would help.",
      },
    ],
    relatedSlugs: ["occupational-therapy", "skilled-nursing"],
  },
  {
    slug: "occupational-therapy",
    title: "Occupational therapy",
    summary:
      "Relearning the everyday tasks that make independent living possible - dressing, bathing, cooking, and moving safely through the home.",
    whoItMayServe: [
      "People adapting to a new physical limitation",
      "People who want to remain independent at home safely",
      "People recovering from a stroke or other neurological event",
    ],
    whatToExpect: [
      "The therapist assesses daily tasks in the actual home environment",
      "Practical strategies and, where useful, adaptive equipment are introduced",
      "Family members can be shown how to safely assist",
    ],
    careProcess: [
      {
        title: "Home assessment",
        body: "The therapist looks at how the home layout affects daily tasks.",
      },
      {
        title: "Skill building",
        body: "Sessions focus on the specific tasks that matter most to the patient.",
      },
      {
        title: "Follow-up",
        body: "Progress is reviewed and the approach adjusts as independence grows.",
      },
    ],
    commonQuestions: [],
    relatedSlugs: ["physical-therapy", "home-health-aide"],
  },
  {
    slug: "speech-therapy",
    title: "Speech therapy",
    summary:
      "Support for communication and swallowing, often following a stroke, surgery or other medical event.",
    whoItMayServe: [
      "People with difficulty speaking, understanding language, or swallowing safely",
      "People recovering from a stroke or head injury",
    ],
    whatToExpect: [
      "A speech-language pathologist evaluates communication and swallowing",
      "Exercises and strategies are tailored to the specific difficulty",
      "Family members learn how to support communication at home",
    ],
    careProcess: [
      {
        title: "Evaluation",
        body: "The therapist assesses speech, language and swallowing safety.",
      },
      {
        title: "Therapy sessions",
        body: "Targeted exercises build toward specific communication or swallowing goals.",
      },
    ],
    commonQuestions: [],
    relatedSlugs: ["occupational-therapy"],
  },
  {
    slug: "medical-social-services",
    title: "Medical social services",
    summary:
      "Help navigating the practical and emotional side of a health change - resources, planning, and support for the whole family.",
    whoItMayServe: [
      "Patients and families adjusting to a serious diagnosis",
      "People who need help connecting to community resources",
      "Families navigating care planning decisions",
    ],
    whatToExpect: [
      "A social worker meets with the patient and family to understand the situation",
      "Practical resources and referrals are identified",
      "Ongoing support is available as circumstances change",
    ],
    careProcess: [
      {
        title: "Initial conversation",
        body: "The social worker learns what the family is facing and what support would help.",
      },
      {
        title: "Connecting resources",
        body: "Relevant community and practical resources are identified together.",
      },
    ],
    commonQuestions: [],
    relatedSlugs: ["skilled-nursing"],
  },
  {
    slug: "home-health-aide",
    title: "Home health aide",
    summary:
      "Help with the daily tasks of living - bathing, dressing, light housekeeping - at the pace the patient needs.",
    whoItMayServe: [
      "People who need help with daily personal care",
      "Families who need additional support alongside skilled care",
    ],
    whatToExpect: [
      "An aide assists with personal care tasks under the care plan",
      "Visits happen on a set schedule",
      "The aide works alongside the rest of the care team, not separately from it",
    ],
    careProcess: [
      {
        title: "Care plan review",
        body: "The aide's tasks are set based on the patient's specific needs.",
      },
      {
        title: "Regular visits",
        body: "The aide provides consistent, scheduled support.",
      },
    ],
    commonQuestions: [],
    relatedSlugs: ["skilled-nursing", "medical-social-services"],
  },
];

export function getServiceBySlug(slug: string) {
  return services.find((s) => s.slug === slug);
}
