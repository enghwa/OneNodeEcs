import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import Easycontainer = require('../lib/easycontainer-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Easycontainer.EasycontainerStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});