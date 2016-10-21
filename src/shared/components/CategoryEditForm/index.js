import React from 'react';
import { connect } from 'react-redux';
import { get, isUndefined, pick, mapValues, isEmpty } from 'lodash';
import { createSelector } from 'reselect';
import { push } from 'react-router-redux';
import { reduxForm, Field, SubmissionError, formValueSelector } from 'redux-form';
import TreeModel from 'tree-model';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';
import {
  Button,
  FormControl,
  FormGroup,
  ControlLabel,
  HelpBlock,
  Alert,
  Modal,
} from 'react-bootstrap';

import { categoryActions } from '../../actions';
import { error } from '../../log';
import SelectInput from '../SelectInput';
import validationHandler from '../../utils/validation-handler';
import style from './style.css';

const messages = defineMessages({
  infoAlert: {
    id: 'component.categoryEditForm.infoAlert',
    description: 'Info alert',
    defaultMessage: 'Select an category to edit or create a new one',
  },
  isSystemAlert: {
    id: 'component.categoryEditForm.isSystemAlert',
    description: 'Is system category alert',
    defaultMessage: 'This system category, it can not be edited or deleted',
  },
  name: {
    label: {
      id: 'component.categoryEditForm.name.label',
      description: 'Label of category name field',
      defaultMessage: 'Name of category',
    },
    placeholder: {
      id: 'component.categoryEditForm.name.placeholder',
      description: 'Placeholder of category name field',
      defaultMessage: 'Name of category',
    },
  },
  type: {
    label: {
      id: 'component.categoryEditForm.type.label',
      description: 'Label of type field',
      defaultMessage: 'Type of category',
    },
  },
  parent: {
    label: {
      id: 'component.categoryEditForm.parent.label',
      description: 'Label of parent field',
      defaultMessage: 'Parent of category',
    },
  },
  saveProcessButton: {
    id: 'component.categoryEditForm.saveProcessButton',
    description: 'Label of button in process',
    defaultMessage: 'Saving...',
  },
  createButton: {
    id: 'component.categoryEditForm.createButton',
    description: 'Label of create button',
    defaultMessage: 'Create',
  },
  saveButton: {
    id: 'component.categoryEditForm.saveButton',
    description: 'Label of save button',
    defaultMessage: 'Save',
  },
  deleteButton: {
    id: 'component.categoryEditForm.deleteButton',
    description: 'Label of delete button',
    defaultMessage: 'Delete',
  },
  deleteProcessButton: {
    id: 'component.categoryEditForm.deleteProcessButton',
    description: 'Label of delete button in process',
    defaultMessage: 'Deleting...',
  },
  deleteModalTitle: {
    id: 'component.categoryEditForm.deleteModalTitle',
    description: 'Title of delete modal',
    defaultMessage: 'Delete category',
  },
  deleteModalConfirm: {
    id: 'component.categoryEditForm.deleteModalConfirm',
    description: 'Confirm text to delete category',
    defaultMessage: 'Are you sure want to delete your category {name}?',
  },
  deleteModalWarning: {
    id: 'component.categoryEditForm.deleteModalWarning',
    description: 'Warning text to delete category',
    defaultMessage: 'All your operations for this category will be moved in "no category"',
  },
  deleteModalError: {
    id: 'component.categoryEditForm.deleteModalError',
    description: 'Delete category error text',
    defaultMessage: 'When you delete an category error occurred',
  },
  cancelButton: {
    id: 'component.categoryEditForm.cancelButton',
    description: 'Label of cancel button',
    defaultMessage: 'Cancel',
  },
});

const TextFormField = field =>
  <FormGroup controlId={field.name} validationState={field.meta.error ? 'error' : null}>
    <ControlLabel>{field.label}</ControlLabel>
    <FormControl
      type="text"
      placeholder={field.placeholder}
      {...field.input}
    />
    <FormControl.Feedback />
    {field.meta.touched && field.meta.error && <HelpBlock>{field.meta.error}</HelpBlock>}
  </FormGroup>;

const SelectFormField = field =>
  <FormGroup controlId={field.name} validationState={field.meta.error ? 'error' : null}>
    <ControlLabel>{field.label}</ControlLabel>
    <SelectInput
      {...field}
      clearable={false}
      options={field.options}
    />
    <FormControl.Feedback />
    {field.meta.touched && field.meta.error && <HelpBlock>{field.meta.error}</HelpBlock>}
  </FormGroup>;

const defaultValues = {
  type: 'expense',
  name: null,
  parent: null,
  _id: null,
};

const fieldsToEdit = Object.keys(defaultValues);

const availableTypesList = ['expense', 'income', 'any'];
const availableTypesListLabeled = availableTypesList.map(type => ({ value: type, label: type }));

const getParentNode = (node) => {
  if (node.isRoot()) {
    return node;
  }

  const nodePath = node.getPath();

  return nodePath[nodePath.length - 2];
};

class CategoryEditForm extends React.Component {
  static propTypes = {
    categoryId: React.PropTypes.string,
    process: React.PropTypes.bool.isRequired,
    form: React.PropTypes.object.isRequired,
    intl: React.PropTypes.object.isRequired,
    updateCategory: React.PropTypes.func.isRequired,
    removeCategory: React.PropTypes.func.isRequired,
    addCategory: React.PropTypes.func.isRequired,
    moveCategory: React.PropTypes.func.isRequired,
    selectCategory: React.PropTypes.func.isRequired,
    isNewCategory: React.PropTypes.bool.isRequired,
    isSystemCategory: React.PropTypes.bool.isRequired,
    availableParentsList: React.PropTypes.array.isRequired,
    availableTypesList: React.PropTypes.array.isRequired,
    canChangeType: React.PropTypes.bool.isRequired,
    categoryNode: React.PropTypes.object,
  };

  constructor(...args) {
    super(...args);

    this.state = {
      categoryDeleteModal: false,
      categoryDeleteError: false,
    };
  }

  getSubmitButton = () => {
    const { submitting } = this.props.form;
    const disabled = submitting || this.props.process;

    let label;

    if (submitting || this.props.process) {
      label = <FormattedMessage {...messages.saveProcessButton} />;
    } else if (this.props.isNewCategory) {
      label = <FormattedMessage {...messages.createButton} />;
    } else {
      label = <FormattedMessage {...messages.saveButton} />;
    }

    return (<Button type="submit" bsStyle="primary" disabled={disabled}>{label}</Button>);
  };

  getDeleteButton = () => {
    if (this.props.isNewCategory) {
      return null;
    }

    return (
      <Button className="pull-right" bsStyle="danger" onClick={this.toggleModal}>
        <FormattedMessage {...messages.deleteButton} />
      </Button>
    );
  };

  submitHandler = (values) => new Promise(async (resolve, reject) => {
    let result;

    try {
      if (this.props.isNewCategory) {
        result = await this.props.addCategory({
          _id: values.parent,
          newNode: pick(values, ['name', 'type']),
        });
      } else {
        if (this.props.categoryNode) {
          const currentParentId = getParentNode(this.props.categoryNode).model._id;

          if (currentParentId !== values.parent) {
            await this.props.moveCategory({ _id: this.props.categoryId, to: values.parent });
          }
        }

        result = await this.props.updateCategory({
          _id: this.props.categoryId,
          name: values.name,
        });
      }
    } catch (err) {
      error(err);

      const validationResult = validationHandler({
        _id: this.props.categoryId,
        name: values.name,
        type: values.type,
        to: values.parent,
      }, err);

      const validationResultErrors = mapValues(validationResult,
        val => this.props.intl.formatMessage({ id: val }));

      reject(new SubmissionError(validationResultErrors));

      return;
    }

    resolve(get(result, 'data.newId'));
  }).then((newId) => {
    if (!this.props.isNewCategory) {
      return;
    }

    this.props.selectCategory(newId);
  });

  toggleModal = () => {
    this.setState({ categoryDeleteModal: !this.state.categoryDeleteModal });
  };

  removeCategory = () =>
    this.props.removeCategory({ _id: this.props.categoryId })
      .then(() => {
        this.toggleModal();
        this.props.selectCategory('');
      }, (e) => {
        error(e);
        this.setState(Object.assign(this.state, { categoryDeleteError: true }));
      });

  render() {
    const { formatMessage } = this.props.intl;
    const { handleSubmit, error, initialValues } = this.props.form;
    const deleteConfirmMessage =
      (<FormattedMessage
        {
        ...Object.assign(messages.deleteModalConfirm,
          { values: { name: (<strong>{initialValues.name}</strong>) } }
        )
        }
      />);

    if (!this.props.categoryId) {
      return (<Alert><FormattedMessage {...messages.infoAlert} /></Alert>);
    }

    if (this.props.isSystemCategory) {
      return (<Alert><FormattedMessage {...messages.isSystemAlert} /></Alert>);
    }

    return (
      <div>
        <form onSubmit={handleSubmit(this.submitHandler)} noValidate>
          <Field
            label={formatMessage(messages.parent.label)}
            name="parent"
            options={this.props.availableParentsList}
            component={SelectFormField}
          />

          <Field
            label={formatMessage(messages.type.label)}
            name="type"
            options={this.props.availableTypesList}
            component={SelectFormField}
            disabled={!this.props.canChangeType}
          />

          <Field
            name="name"
            label={formatMessage(messages.name.label)}
            placeholder={formatMessage(messages.name.placeholder)}
            component={TextFormField}
            type="text"
          />

          { error && <Alert bsStyle="danger">{error}</Alert> }

          <div className={style['action-buttons']}>
            { this.getSubmitButton() }
            { this.getDeleteButton() }
          </div>
        </form>

        <Modal show={this.state.categoryDeleteModal}>
          <Modal.Header>
            <Modal.Title><FormattedMessage {...messages.deleteModalTitle} /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{deleteConfirmMessage}</p>
            <Alert bsStyle="danger"><FormattedMessage {...messages.deleteModalWarning} /></Alert>
          </Modal.Body>
          <Modal.Footer>
            { this.state.accountDeleteError &&
              <p className="text-danger pull-left"><FormattedMessage {...messages.deleteModalError} /></p>
            }

            <Button onClick={this.removeCategory} disabled={this.props.process} bsStyle="danger">
              {
                this.props.process
                  ? <FormattedMessage {...messages.deleteProcessButton} />
                  : <FormattedMessage {...messages.deleteButton} />
              }
            </Button>
            <Button onClick={this.toggleModal} disabled={this.props.process}>
              <FormattedMessage {...messages.cancelButton} />
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

let categoryForm = reduxForm({
  form: 'categoryEdit',
  propNamespace: 'form',
  enableReinitialize: true,
})(CategoryEditForm);

const formFieldSelector = formValueSelector('categoryEdit');

const processSelector = createSelector(
  state => state.category.process,
  process => process,
);

const categoryTreeSelector = createSelector(
  state => state.category.data,
  categoryData => {
    const tree = new TreeModel();
    const rootNode = tree.parse(categoryData);

    return rootNode;
  }
);

const categoryListSelector = createSelector(
  categoryTreeSelector,
  categoryTree => categoryTree.all()
);

const categoryNodeSelector = createSelector(
  categoryTreeSelector,
  (_, props) => props.categoryId,
  (categoryTree, categoryId) => {
    if (categoryId === 'new') {
      return undefined;
    }

    return categoryTree.first((node) => node.model._id === categoryId);
  }
);

const isNewCategorySelector = createSelector(
  categoryNodeSelector,
  categoryToEdit => isUndefined(categoryToEdit),
);

const isSystemCategorySelector = createSelector(
  categoryNodeSelector,
  isNewCategorySelector,
  (categoryNode, isNewCategory) => {
    if (isNewCategory) {
      return false;
    }

    return get(categoryNode, 'model.system', false);
  }
);

const categoryDefaultsSelector = createSelector(
  state => state.category.data,
  categoryNodeSelector,
  (categoryData, categoryNode) => {
    let result = Object.assign({}, defaultValues);

    result.parent = categoryData._id;

    if (categoryNode) {
      result = pick(categoryNode.model, fieldsToEdit);
      result.parent = getParentNode(categoryNode).model._id;
    } else {
      result._id = 'new';
    }

    return result;
  }
);

const initialValuesSelector = createSelector(
  (_, props) => props.categoryId,
  categoryDefaultsSelector,
  state => formFieldSelector(state, ...fieldsToEdit),
  categoryTreeSelector,
  isNewCategorySelector,
  (categoryId, initialValues, currentValues, categoryTree, isNewCategory) => {
    let values;

    if (categoryId === currentValues._id || (isNewCategory && !isEmpty(currentValues))) {
      values = currentValues;
    } else {
      values = initialValues;
    }

    if (categoryId !== currentValues._id && isNewCategory) {
      values = Object.assign({}, initialValues, { _id: categoryId });
    }

    const selectedParent = categoryTree.first(node => node.model._id === values.parent);

    if (selectedParent && !selectedParent.isRoot() && selectedParent.model.type !== 'any') {
      values.type = selectedParent.model.type;
    }

    return values;
  }
);

const getNodeLabel = node => `${'- - '.repeat(node.getPath().length - 1)} ${node.model.name}`;

const availableParentsListSelector = createSelector(
  initialValuesSelector,
  categoryListSelector,
  isNewCategorySelector,
  (initialValues, categoryList, isNewCategory) => {
    const values = Object.assign({}, initialValues);
    const filteredList = isNewCategory
      ? categoryList
      : categoryList.filter(node =>
        (node.model.type === 'any' || node.model.type === values.type)
        && node.model._id !== values._id
      );

    return filteredList.map(node => ({ value: node.model._id, label: getNodeLabel(node) }));
  }
);

const availableTypesListSelector = createSelector(
  initialValuesSelector,
  categoryTreeSelector,
  (initialValues, categoryTree) => {
    const values = Object.assign({}, initialValues);
    const selectedParent = categoryTree.first(node => node.model._id === values.parent);

    if (selectedParent && !selectedParent.isRoot() && selectedParent.model.type !== 'any') {
      return [{ label: selectedParent.model.type, value: selectedParent.model.type }];
    }

    return availableTypesListLabeled;
  }
);

const canChangeTypeSelector = createSelector(
  availableTypesListSelector,
  isNewCategorySelector,
  (availableTypesList, isNewCategory) => availableTypesList.length !== 1 && isNewCategory
);

const selector = createSelector([
  processSelector,
  categoryNodeSelector,
  isNewCategorySelector,
  isSystemCategorySelector,
  availableParentsListSelector,
  availableTypesListSelector,
  canChangeTypeSelector,
  initialValuesSelector,
], (
  process,
  categoryNode,
  isNewCategory,
  isSystemCategory,
  availableParentsList,
  availableTypesList,
  canChangeType,
  initialValues
) => ({
  process,
  categoryNode,
  isNewCategory,
  isSystemCategory,
  availableParentsList,
  availableTypesList,
  canChangeType,
  initialValues,
}));

const mapDispatchToProps = dispatch => ({
  updateCategory: (...args) => dispatch(categoryActions.update(...args)),
  removeCategory: (...args) => dispatch(categoryActions.remove(...args)),
  addCategory: (...args) => dispatch(categoryActions.add(...args)),
  moveCategory: (...args) => dispatch(categoryActions.move(...args)),
  selectCategory: categoryId => dispatch(push(`/dashboard/categories/${categoryId}`)),
});

categoryForm = connect(selector, mapDispatchToProps)(categoryForm);

export default injectIntl(categoryForm);