// iTop-standard priority matrix: impact (rows) × urgency (columns) → priority
// Impact: 1=Department, 2=Service, 3=Person
// Urgency: 1=Critical, 2=High, 3=Medium, 4=Low
// Priority: 1=Critical, 2=High, 3=Medium, 4=Low

const MATRIX = {
  // impact: { urgency: priority }
  1: { 1: 1, 2: 1, 3: 2, 4: 3 },  // Department-level impact
  2: { 1: 1, 2: 2, 3: 3, 4: 3 },  // Service-level impact
  3: { 1: 2, 2: 3, 3: 3, 4: 4 },  // Person-level impact
}

export function computePriority(impact, urgency) {
  const row = MATRIX[impact]
  if (!row) return 3
  return row[urgency] || 3
}
