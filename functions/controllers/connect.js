/* eslint-disable handle-callback-err */
/* eslint-disable promise/always-return */
/* eslint-disable consistent-return */
/* eslint-disable array-callback-return */
/* eslint-disable promise/no-nesting */
'use strict';

const GitHub = require('./../lib/GitHub');
const config = require('./../config');

module.exports = (request, response) => {
  const ua = config.get('analytics.uaTrackingId')
    ? require('universal-analytics')(config.get('analytics.uaTrackingId'))
    : null;

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

      if (ua) {
        ua.event('Repositories', 'Connect').send();
      }
    }).catch(error => {
      response.status(500).send('Error');

      if (ua) {
        ua.event('Repositories', 'Connect error').send();
      }
    });
  });
};
