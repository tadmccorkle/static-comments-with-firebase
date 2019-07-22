# Comment Bot - static-comments-with-firebase

An implementation of [Eduardo Boucas's Staticman](https://staticman.net/) to be hosted with Firebase.

I made some minor changes, removed a few features I don't need, and updated some deprecated code for hosting my own Staticman server with Firebase. [I also added the capability to add emails to site email subscription lists](#site-mailing-lists).

## Using with your own projects

Setting up an equivalent server for your own GitHub Pages sites should be fairly straight-forward. You must have [Node.js](https://nodejs.org/) and npm (included with Node.js) installed.

### Note

I haven't tested this with configurations other than what is on [tadmccorkle.com](https://tadmccorkle.com), the source for which can be found [here](https://github.com/tadmccorkle/tadmccorkle.github.io). If you try something you think should work, but for whatever reason does not work, create a pull request, [let me know](mailto:tad.mccorkle+CommentBotIssue@gmail.com), or make your own implementation.

This implementation also lacks some features of Staticman (ex. Askimet Spam Protection).

This implementation also uses GitHub personal access tokens, which may run into issues with the GitHub API's rate limiting if your server must handle many requests in a short period of time. I plan to update for use with a GitHub App in the future, but using a personal access token is easy and meets my needs at the moment.

### Firebase Implementation

To set up the Firebase server, first, clone this repo:

SSH: `git clone git@github.com:tadmccorkle/static-comments-with-firebase.git`

HTTPS: `git clone https://github.com/tadmccorkle/static-comments-with-firebase.git`

Next, `cd` into the functions directory and `npm install`.

Then, generate an RSA private key:

`openssl genrsa -out key.pem`

You'll need to replace all returns with new line characters (`\n`), so your private key should be of the form:

```txt
-----BEGIN RSA PRIVATE KEY-----\nFIRST_LINE_OF_PRIVATE_KEY\nSECOND-LINE_OF_PRIVATE_KEY\n...\nFINAL_LINE_OF_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----
```

Create a personal access token on GitHub if you don't already have one you can use - this can be done [here](https://github.com/settings/tokens). It must have the 'repo' scope.

After completing each step above, create a file called _config.production.json_ (you can re-purpose the _config.template.json_ file in this repo). It should be set up as follows:

```json
{
  "allowedOrigins": [
    "YOUR.DOMAIN",
    "localhost:4000"
  ],
  "apiOrigin": "https://YOUR_APP.firebaseapp.com",
  "emailHashSalt": "YOUR_SALT_STRING",
  "webhookSecret": "YOUR_WEBHOOK_KEY",
  "githubToken": "YOUR_GITHUB_TOKEN",
  "rsaPrivateKey": "YOUR_RSA_PRIVATE_KEY"
}
```

The allowed origins are the origins from which you want to process comment submissions. Staticman had this in the siteConfig, but it was easier for me to implement this way. You must include your submission origins for Comment Bot to work correctly. Do **not** include _https://_ or _http://_ in your allowed origins. The API will handle both cases.

If you want to use post notifications (a little more information in the section [GitHub Pages Implementation](#github-pages-implementation) below) or a site email list (see [Site Mailing Lists](#site-mailing-lists) below for more information), include your Firebase app's origin and a hash salt string.

The webhookSecret is optional - set it up if you want to ensure the requests to your webhook URL are valid (see the next section, [GitHub Pages Implementation](#github-pages-implementation), for more information). Remove it from the configuration file if you are not using it. If you want to test out development configurations without modifying your production configuration, just be sure to set your environment variable, `NODE_ENV`, appropriately.

If you haven't done so yet, install _firebase-tools_:

`npm install -g firebase-tools`

Create a new Firebase project, which can be done [here](https://console.firebase.google.com). Unfortunately, to interact with the GitHub API, you'll need to enable billing on this project. I'm using the Blaze plan (pay-as-you-go), but my current usage is so low I haven't even come close to reaching my daily limit of $0.24, yet. You can limit your project's usage [here](https://console.cloud.google.com/appengine/settings).

 If needed, authenticate with Firebase:

`firebase login`

From within the project directory, run:

`firebase init functions`

Choose the following configuration options:

> Javascript \
> ESLint: y \
> All Overwrite Prompts: N \
> Install Dependencies: Y

You can modify default POST rate limits in *server.js* if needed.

That should be it for set up! To deploy, run:

`firebase deploy --only functions`

Unless you want to modify your server code, all that should be left is the set up for your GitHub Pages site.

### GitHub Pages Implementation

If your site repo is not owned by the user with the personal access token used above, you must add that user as a collaborator from your site repo's Settings.

Add a *_comment-bot.yml* file to your GitHub Pages repo's root directory. Example contents can be found in *_comment-bot.example-yml* within this repo. The contents of this file are based off the _siteConfig.js_ server file. Be sure to encrypt the appropriate fields with your app so your RSA private key is used.

If using Mailgun for notifications, you must register a Mailgun account, set up a domain, and add your encrypted API key and domain to your *_comment-bot.yml* file. I provided Mailgun with payment information to avoid any issues - just be sure to set your limits to values within the free tier if you want to avoid payments.

If using Google's reCAPTCHA to prevent spam, note that the current Comment Bot implementation uses RecaptchaV2. Your RecaptchaV2 site key and encrypted secret must be in your *_config.yml* (the configuration file for all Jekyll sites) and *_comment-bot.yml* files. They should be as follows in your *_config.yml* file:

```yml
reCaptcha
  siteKey: "YOUR_SITE_KEY"
  secret: "YOUR_ENCRYPTED_SECRET"
```

Your comment form should specify the appropriate options and fields input elements. See [tadmccorkle.com's comment form](https://github.com/tadmccorkle/tadmccorkle.github.io/blob/master/_includes/comment-form.html) as an example. For other examples, refer to [Helpful Resources](#helpful-resources) below.

A webhook should be set up for your repo if you want to use notifications and auto-branch-deletion. From your repo's Settings > Webhooks page, set the Payload URL as *YOUR_FIREBASE_APP_URL/webhook*. Set the Content type to _application/json_. Add a secret if you want to ensure requests to the payload URL are valid webhook events. Schedule the individual "Pull requests" event as the trigger for the webhook.

Done! You should now be able to POST comments to *YOUR_FIREBASE_APP/__entry__/GITHUB_PAGES_REPO_OWNER/GITHUB_PAGES_REPO/GITHUB_PAGES_DEPLOYMENT_BRANCH/comments*.

#### Site Mailing Lists

If your *comment-bot.yml* file contains your encrypted Mailgun API key, encrypted Mailgun domain, and encrypted Mailgun mailing list name, you can add emails to your mailing list with a POST to *YOUR_FIREBASE_APP/__email__/GITHUB_PAGES_REPO_OWNER/GITHUB_PAGES_REPO/GITHUB_PAGES_DEPLOYMENT_BRANCH/comments*. You need to include an `apiOrigin` and `emailHashSalt` in your private configuration file. No spam protection is used for this portion of the API other than rate limiting. You will be responsible for sending emails to the mailing list.

[Let me know](mailto:tad.mccorkle+CommentBotTutorial@gmail.com), or create a pull request, if I left anything important out of the instructions above.

### Double Opt-In

This API currently only supports double opt-in for email lists, so a confirmation email is sent when someone subscribes to the site mailing list or requests notification emails on a post.

## Helpful Resources

See the following for help with Staticman/Comment Bot:

- [Staticman source](https://github.com/eduardoboucas/staticman)
- [Staticman site](https://staticman.net/)
- [Eduardo Boucas's site source](https://github.com/eduardoboucas/eduardoboucas.com)
- [Spinning Numbers site source](https://github.com/willymcallister/willymcallister.github.io)
- [Made Mistakes site source](https://github.com/mmistakes/made-mistakes-jekyll)
- [My personal site source](https://github.com/tadmccorkle/tadmccorkle.github.io)
- [Helpful post by Made Mistakes for Staticman](https://mademistakes.com/articles/using-jekyll-2017/)
- [Helpful post by Spinning Numbers for Staticman](https://spinningnumbers.org/a/staticman.html)
- [Hosting Staticman with Heroku tutorial](https://vincenttam.gitlab.io/post/2018-09-16-staticman-powered-gitlab-pages/2/)
- [Firebase functions video tutorial](https://www.youtube.com/watch?v=LOeioOKUKI8)
- [Firebase functions documentation](https://firebase.google.com/docs/functions)

## Are you using this?

If so, [let me know](mailto:tad.mccorkle+UsingCommentBot@gmail.com)!

## Many thanks!

To [Eduardo Boucas](https://eduardoboucas.com/) for his excellent work on Staticman!
