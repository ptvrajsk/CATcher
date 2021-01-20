import { browser, element, by, ExpectedConditions } from 'protractor';
import { credentials } from '../test.credentials';


export class LoginPage {
  navigateTo(route: string) {
    return browser.get(route);
  }

  async getTitle() {
    return await element(by.css('app-root')).element(by.css('app-layout-header')).getText();
  }

  async getConfirmationScreenTitle() {
    return await element(by.className('login-title')).getText();
  }

  async login() {
    await this.selectSession();
    /**
     * TODO: Remove these lines since auth is mocked up and
     * does not require the filling of credentials or spawning of
     * new window.
     */
    // await this.fillCredentials();
    // await this.selectWindow(0);
  }

  async confirmUser() {
    await browser.wait(ExpectedConditions.presenceOf(element(by.className('sign-in-button'))));
    const confirm = element(by.className('sign-in-button'));
    await confirm.click();
  }

  private async selectSession() {
    const profiles = element(by.css('app-root')).element(by.css('app-profiles'));

    await profiles.click();
    const options = element.all(by.className('mat-option')).get(1);
    await options.click();

    const button = element(by.className('sign-in-button'));
    await button.click();
  }

  private async fillCredentials() {
    await browser.waitForAngularEnabled(false);
    await this.selectWindow(1);
    await browser.wait(ExpectedConditions.presenceOf(element(by.name('login'))));
    await element(by.name('login')).sendKeys(credentials.username);
    await element(by.name('password')).sendKeys(credentials.password);
    await element(by.name('commit')).click();
    await browser.waitForAngularEnabled(true);
  }

  private async selectWindow(index) {

      // wait for handels[index] to exist
    await browser.driver.wait(function() {
        return browser.driver.getAllWindowHandles().then(function (handles) {
            if(handles.length > index) {
              return true;
            }
          });
      });

      // switch to the window
      return browser.driver.getAllWindowHandles().then(function (handles) {
        return browser.driver.switchTo().window(handles[index]);
      });
    };
}
