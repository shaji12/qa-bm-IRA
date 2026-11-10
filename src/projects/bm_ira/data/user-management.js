const { randomUUID } = require('crypto');

const userTableHeadersExpected = ['Name', 'Email', 'Institution', 'User Role', 'Status'];

function createUser() {
  return {
    name: 'QA User',
    email: `qa.user.${randomUUID()}@example.com`,
    institution: 'NIMS Corp',
    role: 'User',
  };
}

const userManagementData = {
  duplicateUser: {
    name: 'Duplicate QA User',
    institution: 'NIMS Corp',
    role: 'User',
  },
};

module.exports = { userTableHeadersExpected, userManagementData, createUser };
