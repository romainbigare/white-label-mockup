// Everything that is particular to MMC, the analytics provider. A new provider is a new file of
// the same shape; nothing else in Wafra's database or functions names the provider.
//
// Messages and passes use Wafra's own words: the levels `basic` and `premium` and the services
// `crops` and `trees`. MMC maps them to its own products on its side, from the feature list per
// level that Wafra gives it.
const { defineString, defineSecret } = require('firebase-functions/params');

module.exports = {
  // farms.provider and farmService.provider.
  name: 'mmc',
  // `aud` of the farm pass: a pass for MMC is refused anywhere else.
  audience: 'mmc',
  // Where Wafra posts farm changes, the daily full list and survey requests. Empty until MMC
  // gives it: nothing is sent meanwhile (provider-sync.js).
  webhookUrl: defineString('MMC_WEBHOOK_URL', { description: "MMC's address for Wafra's messages (empty: send nothing)", default: '' }),
  // The only caller allowed on providerSurveyResult and checkFarms. Empty: nobody is let in.
  callerServiceAccount: defineString('MMC_SERVICE_ACCOUNT', {
    description: 'Email of the Google service account MMC calls Wafra with (empty: nobody)',
    default: '',
  }),
  // Makes the code name (`sub`) of a person at MMC. One secret per provider, so two providers'
  // code names for the same person never match.
  subSecret: defineSecret('PASS_SUB_SECRET_MMC'),
};
