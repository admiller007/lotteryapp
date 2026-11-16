// Login matches first name, last name and facility case-insensitively and
// ignoring all whitespace ("Main Office" == "mainoffice"). The key is stored
// on each user doc so the login route can find candidates with one query.
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');

export const buildLoginKey = (firstName: string, lastName: string, facilityName: string) =>
  [firstName, lastName, facilityName].map(normalize).join('|');
