module.exports = {
    parseGithub: function (request) {
        if (request.body.ref && request.body.head_commit && request.body.head_commit.timestamp) {
            var ref_splitted = request.body.ref.split('/');

            return {
                repo: request.body.repository.git_url,
                branch: ref_splitted[2],
                timestamp: request.body.head_commit.timestamp,
                message: request.body.head_commit.message,
                email: request.body.pusher.email,
                repo_name: request.body.repository.name
            }
        }
    },
};