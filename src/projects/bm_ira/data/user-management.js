const { randomUUID } = require('crypto');

const userTableHeadersExpected = ['S.No', 'Name', 'Email', 'Institution', 'User Role', 'Status', 'Action'];

function createUser() {
  return {
    name: 'Qa User',
    email: `qa.user.${randomUUID().replace(/-/g, '')}@gmail.com`,
    password: 'Qa@12345',
    institution: 'Abc School',
    role: 'Admin Manager',
  };
}

const userManagementData = {
  duplicateUser: {
    name: 'Duplicate QA User',
    password: 'Qa@12345',
    institution: 'Abc School',
    role: 'Admin Manager',
  },
};

module.exports = { userTableHeadersExpected, userManagementData, createUser };
