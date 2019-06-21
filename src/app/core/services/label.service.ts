import { Injectable } from '@angular/core';
import { GithubService } from './github.service';
import { map } from 'rxjs/operators';
import { Label } from '../models/label.model';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

/* The threshold to decide if color is dark or light.
A higher threshold value will result in more colors determined to be "dark".
W3C recommendation is 0.179, but 0.184 is chosen so that some colors (like bright red)
are considered dark (Github too consider them dark) */
const COLOR_DARKNESS_THRESHOLD = 0.184;

const COLOR_DARK_TEXT  = '000000'; // Dark color for text with light background
const COLOR_LIGHT_TEXT  = 'FFFFFF'; // Light color for text with dark background

@Injectable({
  providedIn: 'root'
})
export class LabelService {

  private readonly REQUIRED_LABELS = {
    severity: {
      Low: new Label('severity', 'Low', 'ffb3b3'),
      Medium: new Label('severity', 'Medium', 'ff6666'),
      High: new Label('severity', 'High', 'b30000')
    },
    type: {
      DocumentationBug: new Label('type', 'DocumentationBug', 'ccb3ff'),
      FunctionalityBug: new Label('type', 'FunctionalityBug', '661aff')
    },
    response: {
      Accepted: new Label('response', 'Accepted', '80ffcc'),
      Rejected: new Label('response', 'Rejected', 'ff80b3'),
      IssueUnclear: new Label('response', 'IssueUnclear', 'ffcc80'),
      CannotReproduce: new Label('response', 'CannotReproduce', 'bfbfbf')
    },
    status: {
      Done: new Label('status', 'Done', 'b3ecff'),
      Incomplete: new Label('status', 'Incomplete', '1ac6ff')
    }
  };

  private severityLabels: Label[] = Object.values(this.REQUIRED_LABELS.severity);
  private typeLabels: Label[] = Object.values(this.REQUIRED_LABELS.type);
  private responseLabels: Label[] = Object.values(this.REQUIRED_LABELS.response);
  private statusLabels: Label[] = Object.values(this.REQUIRED_LABELS.status);
  private labelArrays = {
    severity: this.severityLabels,
    type: this.typeLabels,
    response: this.responseLabels,
    status: this.statusLabels
  };

  constructor(private githubService: GithubService) {
  }

  /**
   * Synchronizes the labels in github with those required by the application.
   */
  synchronizeRemoteLabels(userResponse: User): Observable<User> {
      return this.githubService.fetchAllLabels().pipe(
        map((response) => {
          this.ensureRepoHasRequiredLabels(this.parseLabelData(response), this.getRequiredLabelsAsArray());
          return userResponse;
        })
      );
  }

  /**
   * Returns all the labels of a certain type (e.g severity)
   * @param attributeName: the type of the label
   * @return an array of label of that type
   */
  getLabelList(attributeName: string): Label[] {
    switch (attributeName) {
      case 'severity':
        return this.severityLabels;
      case 'type':
        return this.typeLabels;
      case 'responseTag':
      case 'response':
        return this.responseLabels;
    }
  }

  /**
   * Returns the color of the label by searching a list of
   * all available labels.
   * @param labelValue: the label's value (e.g Low / Medium / High / ...)
   */
  getColorOfLabel(labelValue: string): string {
    // TODO: Rewrite function - labelValue insufficient to differentiate between labels. Should use `labelCategory.labelValue` format.
    const WHITE_COLOR = 'ffffff';
    if (labelValue === '') {
      return WHITE_COLOR;
    }

    const existingLabel = this.getRequiredLabelsAsArray().find(label => label.labelValue === labelValue);

    if (existingLabel === undefined || existingLabel.labelColor === undefined) {
      return WHITE_COLOR;
    } else {
      return existingLabel.labelColor;
    }
  }

  private getRequiredLabelsAsArray(): Label[] {
    let requiredLabels: Label[] = [];

    for (const category of Object.keys(this.labelArrays)) {
      requiredLabels = requiredLabels.concat(this.labelArrays[category]);
    }

    return requiredLabels;
  }

  /**
   * Ensures that the repo has the required labels.
   * Compares the actual labels in the repo with the required labels. If an required label is missing,
   * it is added to the repo. If the required label exists but the label color is not as expected,
   * the color is updated. Does not delete actual labels that do not match required labels.
   * i.e., the repo might have more labels than the required labels after this operation.
   * @param actualLabels: labels in the repo.
   * @param requiredLabels: required labels.
   */
  private ensureRepoHasRequiredLabels(actualLabels: Label[], requiredLabels: Label[]): void {

    requiredLabels.forEach(label => {

      // Finds for a label that has the same name as a required label.
      const nameMatchedLabels: Label[] = actualLabels.filter(remoteLabel =>
          remoteLabel.getFormattedName() === label.getFormattedName());

      if (nameMatchedLabels.length === 0) {
        // Create new Label (Could not find a label with the same name & category)
        this.githubService.createLabel(label.getFormattedName(), label.labelColor);
      } else if (nameMatchedLabels.length === 1) {
        if (nameMatchedLabels[0].equals(label)) {
          // the label exists exactly as expected -> do nothing
        } else {
          // the label exists but the color does not match
          this.githubService.updateLabel(label.getFormattedName(), label.labelColor);
        }
      } else {
        throw new Error('Unexpected error: the repo has multiple labels with the same name ' + label.getFormattedName());
      }

    });
  }

  /**
   * Parses label information and returns an array of Label objects.
   * @param labels - Label Information from API.
   */
  parseLabelData(labels: Array<{}>): Label[] {
    const labelData: Label[] = [];
    for (const label of labels) {

      const labelName: string[] = String(label['name']).split('.');
      const labelCategory: string = labelName[0];
      const labelValue: string = labelName[1];
      const labelColor: string = String(label['color']);

      labelData.push(new Label(labelCategory, labelValue, labelColor));
    }
    return labelData;
  }

  reset(): void {
    this.severityLabels.length = 0;
    this.typeLabels.length = 0;
    this.responseLabels.length = 0;
  }

   /**
   * Returns true if the given color is considered "dark"
   * The color is considered "dark" if its luminance is less than COLOR_DARKNESS_THRESHOLD
   * @param inputColor: the color
   */
  isDarkColor(inputColor: string): boolean {
    const COLOR = (inputColor.charAt(0) === '#') ? inputColor.substring(1, 7) : inputColor;
    const R = parseInt(COLOR.substring(0, 2), 16);
    const G = parseInt(COLOR.substring(2, 4), 16);
    const B = parseInt(COLOR.substring(4, 6), 16);
    const RGB = [R / 255, G / 255, B / 255];
    const LINEAR_RGB = RGB.map((col) => {
      if (col <= 0.03928) {
        return col / 12.92;
      }
      return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    // Calculate the luminance of the color
    const LUMINANCE = (0.2126 * LINEAR_RGB[0]) + (0.7152 * LINEAR_RGB[1]) + (0.0722 * LINEAR_RGB[2]);
    // The color is "dark" if the luminance is lower than the threshold
    return LUMINANCE < COLOR_DARKNESS_THRESHOLD;
  }

  /**
   * Returns a css style for the label to use
   * @param color: the color of the label
   * @return the style with background-color in rgb
   * @throws exception if input is an invalid color code
   */
  setLabelStyle(color: string) {
    let textColor: string;

    textColor = this.isDarkColor(color) ? COLOR_LIGHT_TEXT : COLOR_DARK_TEXT;

    const styles = {
      'background-color' : `#${color}`,
      'border-radius' : '3px',
      'padding' : '3px',
      'color' : `#${textColor}`,
      'font-weight' : '410',
    };

    return styles;
  }

}