/**
 * Template Schema — Sector definitions, compliance frameworks, validation.
 */

const ORG_SIZES = ["solo", "small", "medium", "large", "enterprise"];

const SECTOR_DEFINITIONS = {
  government:        { name: "Government",              icon: "building-columns", order: 1 },
  education:         { name: "Education",               icon: "graduation-cap",   order: 2 },
  healthcare:        { name: "Healthcare",              icon: "heart-pulse",      order: 3 },
  legal:             { name: "Legal",                   icon: "scale-balanced",   order: 4 },
  financial:         { name: "Financial Services",      icon: "landmark",         order: 5 },
  retail:            { name: "Retail & E-Commerce",     icon: "store",            order: 6 },
  food:              { name: "Food & Beverage",         icon: "utensils",         order: 7 },
  realestate:        { name: "Real Estate",             icon: "house",            order: 8 },
  construction:      { name: "Construction & Trades",   icon: "hard-hat",         order: 9 },
  manufacturing:     { name: "Manufacturing",           icon: "industry",         order: 10 },
  technology:        { name: "Technology",              icon: "microchip",        order: 11 },
  "professional-services": { name: "Professional Services", icon: "briefcase",   order: 12 },
  nonprofit:         { name: "Nonprofit & Community",   icon: "hand-holding-heart", order: 13 },
  hospitality:       { name: "Hospitality & Tourism",   icon: "hotel",            order: 14 },
  transportation:    { name: "Transportation & Logistics", icon: "truck",         order: 15 },
  automotive:        { name: "Automotive",              icon: "car",              order: 16 },
  "personal-care":   { name: "Beauty & Personal Care",  icon: "spa",              order: 17 },
  media:             { name: "Media & Entertainment",   icon: "film",             order: 18 },
  agriculture:       { name: "Agriculture",             icon: "tractor",          order: 19 },
  energy:            { name: "Energy & Utilities",      icon: "bolt",             order: 20 },
  care:              { name: "Childcare & Senior Care",  icon: "people-roof",     order: 21 },
  "other-services":  { name: "Other Services",          icon: "wrench",           order: 22 },
  solopreneur:       { name: "Solopreneur",             icon: "user",             order: 23 },
};

const COMPLIANCE_FRAMEWORKS = {
  // Government
  FOIA:        { name: "FOIA", fullName: "Freedom of Information Act" },
  ADA:         { name: "ADA", fullName: "Americans with Disabilities Act" },
  FEDRAMP:     { name: "FedRAMP", fullName: "Federal Risk and Authorization Management Program" },
  FISMA:       { name: "FISMA", fullName: "Federal Information Security Modernization Act" },
  SECTION_508: { name: "Section 508", fullName: "Section 508 of the Rehabilitation Act" },
  OPEN_MEETINGS: { name: "Open Meetings", fullName: "State Open Meetings Laws" },

  // Education
  FERPA:       { name: "FERPA", fullName: "Family Educational Rights and Privacy Act" },
  COPPA:       { name: "COPPA", fullName: "Children's Online Privacy Protection Act" },
  TITLE_IX:    { name: "Title IX", fullName: "Title IX of the Education Amendments" },
  IDEA:        { name: "IDEA", fullName: "Individuals with Disabilities Education Act" },
  CLERY:       { name: "Clery Act", fullName: "Jeanne Clery Disclosure of Campus Security Policy Act" },

  // Healthcare
  HIPAA:       { name: "HIPAA", fullName: "Health Insurance Portability and Accountability Act" },
  HITECH:      { name: "HITECH", fullName: "Health Information Technology for Economic and Clinical Health Act" },
  CFR42_PART2: { name: "42 CFR Part 2", fullName: "Confidentiality of Substance Use Disorder Patient Records" },

  // Financial
  SOX:         { name: "SOX", fullName: "Sarbanes-Oxley Act" },
  GLBA:        { name: "GLBA", fullName: "Gramm-Leach-Bliley Act" },
  BSA_AML:     { name: "BSA/AML", fullName: "Bank Secrecy Act / Anti-Money Laundering" },
  PCI_DSS:     { name: "PCI-DSS", fullName: "Payment Card Industry Data Security Standard" },
  TILA:        { name: "TILA", fullName: "Truth in Lending Act" },
  RESPA:       { name: "RESPA", fullName: "Real Estate Settlement Procedures Act" },
  HMDA:        { name: "HMDA", fullName: "Home Mortgage Disclosure Act" },
  SEC_FINRA:   { name: "SEC/FINRA", fullName: "Securities and Exchange Commission / Financial Industry Regulatory Authority" },

  // Privacy
  GDPR:        { name: "GDPR", fullName: "General Data Protection Regulation" },
  CCPA:        { name: "CCPA", fullName: "California Consumer Privacy Act" },

  // Safety
  OSHA:        { name: "OSHA", fullName: "Occupational Safety and Health Administration" },
  EPA:         { name: "EPA", fullName: "Environmental Protection Agency" },

  // Food
  FDA:         { name: "FDA", fullName: "Food and Drug Administration" },
  FSMA:        { name: "FSMA", fullName: "Food Safety Modernization Act" },
  HACCP:       { name: "HACCP", fullName: "Hazard Analysis and Critical Control Points" },

  // Defense
  ITAR:        { name: "ITAR", fullName: "International Traffic in Arms Regulations" },
  DFARS:       { name: "DFARS", fullName: "Defense Federal Acquisition Regulation Supplement" },
  CMMC:        { name: "CMMC", fullName: "Cybersecurity Maturity Model Certification" },
  NIST_800_171: { name: "NIST 800-171", fullName: "Protecting Controlled Unclassified Information" },

  // Tech
  SOC2:        { name: "SOC 2", fullName: "Service Organization Control 2" },
  ISO_27001:   { name: "ISO 27001", fullName: "Information Security Management" },

  // Transportation
  FMCSA:       { name: "FMCSA", fullName: "Federal Motor Carrier Safety Administration" },
  DOT:         { name: "DOT", fullName: "Department of Transportation" },
  FTA:         { name: "FTA", fullName: "Federal Transit Administration" },

  // Real Estate
  FAIR_HOUSING: { name: "Fair Housing", fullName: "Fair Housing Act" },

  // Nonprofit / Political
  FEC:         { name: "FEC", fullName: "Federal Election Commission" },
  IRS_501C3:   { name: "IRS 501(c)(3)", fullName: "Tax-Exempt Organization" },

  // General
  FTC:         { name: "FTC", fullName: "Federal Trade Commission" },
  EEOC:        { name: "EEOC", fullName: "Equal Employment Opportunity Commission" },
  DEA:         { name: "DEA", fullName: "Drug Enforcement Administration" },
};

function validateTemplate(t) {
  const errors = [];
  if (!t.id || typeof t.id !== "string") errors.push("id is required (string)");
  if (!t.name || typeof t.name !== "string") errors.push("name is required (string)");
  if (!t.sector || !SECTOR_DEFINITIONS[t.sector]) errors.push(`invalid sector: ${t.sector}`);
  if (!Array.isArray(t.size) || !t.size.every((s) => ORG_SIZES.includes(s))) errors.push("size must be array of valid sizes");
  if (!Array.isArray(t.departments)) errors.push("departments must be an array");
  if (!t.governance || typeof t.governance !== "object") errors.push("governance must be an object");
  if (!Array.isArray(t.discoveryKeywords)) errors.push("discoveryKeywords must be an array");
  return { valid: errors.length === 0, errors };
}

module.exports = { SECTOR_DEFINITIONS, COMPLIANCE_FRAMEWORKS, ORG_SIZES, validateTemplate };
