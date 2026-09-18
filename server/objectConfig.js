// Central place that defines which Salesforce standard objects are exposed
// in the UI and which fields (5-10 each) are shown/edited for each one.
// Feel free to tweak the field lists - just keep between 5 and 10 fields.

const OBJECT_CONFIG = {
  Account: {
    label: "Account",
    fields: [
      { name: "Name", label: "Account Name", type: "string", required: true },
      { name: "Industry", label: "Industry", type: "picklist" },
      { name: "Phone", label: "Phone", type: "phone" },
      { name: "Website", label: "Website", type: "url" },
      { name: "AnnualRevenue", label: "Annual Revenue", type: "currency" },
      { name: "BillingCity", label: "Billing City", type: "string" },
      { name: "NumberOfEmployees", label: "Employees", type: "int" }
    ]
  },
  Contact: {
    label: "Contact",
    fields: [
      { name: "FirstName", label: "First Name", type: "string" },
      { name: "LastName", label: "Last Name", type: "string", required: true },
      { name: "Email", label: "Email", type: "email" },
      { name: "Phone", label: "Phone", type: "phone" },
      { name: "Title", label: "Title", type: "string" },
      { name: "Department", label: "Department", type: "string" }
    ]
  },
  Lead: {
    label: "Lead",
    fields: [
      { name: "FirstName", label: "First Name", type: "string" },
      { name: "LastName", label: "Last Name", type: "string", required: true },
      { name: "Company", label: "Company", type: "string", required: true },
      { name: "Email", label: "Email", type: "email" },
      { name: "Status", label: "Status", type: "picklist" },
      { name: "Phone", label: "Phone", type: "phone" }
    ]
  },
  Opportunity: {
    label: "Opportunity",
    fields: [
      { name: "Name", label: "Opportunity Name", type: "string", required: true },
      { name: "StageName", label: "Stage", type: "picklist", required: true },
      { name: "CloseDate", label: "Close Date", type: "date", required: true },
      { name: "Amount", label: "Amount", type: "currency" },
      { name: "Probability", label: "Probability (%)", type: "int" },
      { name: "Type", label: "Type", type: "picklist" }
    ]
  },
  Case: {
    label: "Case",
    fields: [
      { name: "Subject", label: "Subject", type: "string", required: true },
      { name: "Status", label: "Status", type: "picklist" },
      { name: "Priority", label: "Priority", type: "picklist" },
      { name: "Origin", label: "Origin", type: "picklist" },
      { name: "Description", label: "Description", type: "textarea" }
    ]
  }
};

const ALLOWED_OBJECTS = Object.keys(OBJECT_CONFIG);

module.exports = { OBJECT_CONFIG, ALLOWED_OBJECTS };
