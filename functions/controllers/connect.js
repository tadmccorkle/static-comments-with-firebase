/* eslint-disable handle-callback-err */
/* eslint-disable promise/always-return */
/* eslint-disable consistent-return */
/* eslint-disable array-callback-return */
/* eslint-disable promise/no-nesting */
'use strict';

const GitHub = require('./../lib/GitHub');
const config = require('./../config');

module.exports = (request, response) => {
  const github = new GitHub({
    username: request.params.username,
    repository: request.params.repository,
    branch: request.params.branch,
    token: config.get('githubToken')
  });

  return github.api.repos.listInvitationsForAuthenticatedUser({}).then(({data}) => {
    let invitationId = null;

    const invitation = Array.isArray(data) && data.some(invitation => {
      if (invitation.repository.full_name === (request.params.username + '/' + request.params.repository)) {
        invitationId = invitation.id;

        return true;
      }
    });

    if (!invitation) {
      return response.status(404).send('Invitation not found');
    }

    return github.api.repos.acceptInvitation({
      invitation_id: invitationId
    }).then(response => {
      response.send('OK!');
    }).catch(error => {
      response.status(500).send('Error');
    });
  });
};
