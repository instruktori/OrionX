// Visual assets supplied in External References. Colors belong to the artwork;
// orange is the single interactive accent used by the application.
export const skillTypes = [
  {
    id: "AI Skill",
    label: "AI Skill",
    format: "Focused learning",
    image: "ai-skill",
    description:
      "A defined AI competency developed through a workshop, masterclass, or focused learning activity.",
  },
  {
    id: "AI Applied Skill",
    label: "AI Applied Skill",
    format: "Applied learning",
    image: "ai-applied",
    description:
      "Hands-on application of an AI competency through a bootcamp, hackathon, or practical challenge.",
  },
  {
    id: "AI Advanced Skill",
    label: "AI Advanced Skill",
    format: "Extended academic learning",
    image: "ai-advanced",
    description:
      "Extended, formally assessed development of an AI competency through an academic course.",
  },
] as const;

export const coverArtwork = [
  {
    image: "latest-skillset",
    label: "Latest AI skillset",
    width: 1498,
    height: 321,
  },
  {
    image: "blockchain-verified",
    label: "Blockchain verification stamp",
    width: 1051,
    height: 429,
  },
  {
    image: "digital-passport",
    label: "AI Skills Digital Passport",
    width: 1251,
    height: 641,
  },
  {
    image: "international-skills",
    label: "International skills recognition",
    width: 860,
    height: 860,
  },
  {
    image: "issued-by-btu",
    label: "BTU issuer stamp",
    width: 1485,
    height: 429,
  },
];

export const imagePath = (name: string) => `/images/btu/${name}.webp`;
