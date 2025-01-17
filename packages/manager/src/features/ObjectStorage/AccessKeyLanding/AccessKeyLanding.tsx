import {
  createObjectStorageKeys,
  getObjectStorageKeys,
  ObjectStorageKey,
  ObjectStorageKeyRequest,
  revokeObjectStorageKey,
  updateObjectStorageKey,
} from '@linode/api-v4/lib/object-storage';
import { FormikBag } from 'formik';
import { pathOr } from 'ramda';
import * as React from 'react';
import { compose } from 'recompose';
import SecretTokenDialog from 'src/features/Profile/SecretTokenDialog';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import Pagey, { PaginationProps } from 'src/components/Pagey';
import PaginationFooter from 'src/components/PaginationFooter';
import { useErrors } from 'src/hooks/useErrors';
import { useOpenClose } from 'src/hooks/useOpenClose';
import { useAccountSettings } from 'src/queries/accountSettings';
import { getAPIErrorOrDefault, getErrorMap } from 'src/utilities/errorUtils';
import {
  sendCreateAccessKeyEvent,
  sendEditAccessKeyEvent,
  sendRevokeAccessKeyEvent,
} from 'src/utilities/ga';
import AccessKeyDrawer from './AccessKeyDrawer';
import AccessKeyTable from './AccessKeyTable';
import RevokeAccessKeyDialog from './RevokeAccessKeyDialog';
import { MODE, OpenAccessDrawer } from './types';
import ViewPermissionsDrawer from './ViewPermissionsDrawer';

interface Props {
  isRestrictedUser: boolean;
  accessDrawerOpen: boolean;
  openAccessDrawer: (mode: MODE) => void;
  closeAccessDrawer: () => void;
  mode: MODE;
}

export type FormikProps = FormikBag<CombinedProps, ObjectStorageKeyRequest>;

type CombinedProps = Props & PaginationProps<ObjectStorageKey>;

export const AccessKeyLanding: React.FC<CombinedProps> = (props) => {
  const {
    closeAccessDrawer,
    openAccessDrawer,
    mode,
    accessDrawerOpen,
    ...paginationProps
  } = props;

  const {
    data: accountSettings,
    refetch: requestAccountSettings,
  } = useAccountSettings();

  // Key to display in Confirmation Modal upon creation
  const [
    keyToDisplay,
    setKeyToDisplay,
  ] = React.useState<ObjectStorageKey | null>(null);

  // Key to rename (by clicking on a key's kebab menu )
  const [keyToEdit, setKeyToEdit] = React.useState<ObjectStorageKey | null>(
    null
  );

  // Key to revoke (by clicking on a key's kebab menu )
  const [keyToRevoke, setKeyToRevoke] = React.useState<ObjectStorageKey | null>(
    null
  );
  const [isRevoking, setIsRevoking] = React.useState<boolean>(false);
  const [revokeErrors, setRevokeErrors] = useErrors();

  const displayKeysDialog = useOpenClose();
  const revokeKeysDialog = useOpenClose();
  const viewPermissionsDrawer = useOpenClose();

  // Request object storage key when component is first rendered
  React.useEffect(() => {
    paginationProps.request();
  }, []);

  const handleCreateKey = (
    values: ObjectStorageKeyRequest,
    { setSubmitting, setErrors, setStatus }: FormikProps
  ) => {
    // Clear out status (used for general errors)
    setStatus(null);
    setSubmitting(true);

    createObjectStorageKeys(values)
      .then((data) => {
        setSubmitting(false);

        setKeyToDisplay(data);

        // "Refresh" keys to include the newly created key
        paginationProps.request();

        props.closeAccessDrawer();
        displayKeysDialog.open();

        // If our Redux Store says that the user doesn't have OBJ enabled,
        // it probably means they have just enabled it with the creation
        // of this key. In that case, update the Redux Store so that
        // subsequently created keys don't need to go through the
        // confirmation flow.
        if (accountSettings?.object_storage === 'disabled') {
          requestAccountSettings();
        }

        // @analytics
        sendCreateAccessKeyEvent();
      })
      .catch((errorResponse) => {
        // We also need to refresh account settings on failure, since, depending
        // on the error, Object Storage service might have actually been enabled.
        if (accountSettings?.object_storage === 'disabled') {
          requestAccountSettings();
        }

        setSubmitting(false);

        const errors = getAPIErrorOrDefault(
          errorResponse,
          'There was an issue creating your Access Key.'
        );
        const mappedErrors = getErrorMap(['label'], errors);

        // `status` holds general errors
        if (mappedErrors.none) {
          setStatus(mappedErrors.none);
        }

        setErrors(mappedErrors);
      });
  };

  const handleEditKey = (
    values: ObjectStorageKeyRequest,
    { setSubmitting, setErrors, setStatus }: FormikProps
  ) => {
    // This shouldn't happen, but just in case.
    if (!keyToEdit) {
      return;
    }

    // Clear out status (used for general errors)
    setStatus(null);

    // If the new label is the same as the old one, no need to make an API
    // request. Just close the drawer and return early.
    if (values.label === keyToEdit.label) {
      return closeAccessDrawer();
    }

    setSubmitting(true);

    updateObjectStorageKey(keyToEdit.id, { label: values.label })
      .then((_) => {
        setSubmitting(false);

        // "Refresh" keys to display the newly updated key
        paginationProps.request();

        closeAccessDrawer();

        // @analytics
        sendEditAccessKeyEvent();
      })
      .catch((errorResponse) => {
        setSubmitting(false);

        const errors = getAPIErrorOrDefault(
          errorResponse,
          'There was an issue updating your Access Key.'
        );
        const mappedErrors = getErrorMap(['label'], errors);

        // `status` holds general errors
        if (mappedErrors.none) {
          setStatus(mappedErrors.none);
        }

        setErrors(mappedErrors);
      });
  };

  const handleRevokeKeys = () => {
    // This shouldn't happen, but just in case.
    if (!keyToRevoke) {
      return;
    }

    setIsRevoking(true);
    setRevokeErrors([]);

    revokeObjectStorageKey(keyToRevoke.id)
      .then((_) => {
        setIsRevoking(false);

        // "Refresh" keys to remove the newly revoked key
        paginationProps.request();

        revokeKeysDialog.close();

        // @analytics
        sendRevokeAccessKeyEvent();
      })
      .catch((errorResponse) => {
        setIsRevoking(false);

        const errors = getAPIErrorOrDefault(
          errorResponse,
          'There was an issue revoking your Access Key.'
        );
        setRevokeErrors(errors);
      });
  };

  const openDrawer: OpenAccessDrawer = (
    mode: MODE,
    objectStorageKey: ObjectStorageKey | null = null
  ) => {
    setKeyToEdit(objectStorageKey);
    switch (mode) {
      case 'creating':
      case 'editing':
        openAccessDrawer(mode);
        break;
      case 'viewing':
        viewPermissionsDrawer.open();
    }
  };

  const openRevokeDialog = (objectStorageKey: ObjectStorageKey) => {
    setKeyToRevoke(objectStorageKey);
    revokeKeysDialog.open();
  };

  const closeRevokeDialog = () => {
    setRevokeErrors([]);
    revokeKeysDialog.close();
  };

  return (
    <div>
      <DocumentTitleSegment segment="Access Keys" />
      <AccessKeyTable
        {...paginationProps}
        openDrawer={openDrawer}
        openRevokeDialog={openRevokeDialog}
        data-qa-access-key-table
      />
      <PaginationFooter
        page={props.page}
        pageSize={props.pageSize}
        count={props.count}
        handlePageChange={props.handlePageChange}
        handleSizeChange={props.handlePageSizeChange}
        eventCategory="object storage keys table"
      />
      <AccessKeyDrawer
        open={accessDrawerOpen}
        onClose={closeAccessDrawer}
        onSubmit={mode === 'creating' ? handleCreateKey : handleEditKey}
        mode={mode}
        objectStorageKey={keyToEdit ? keyToEdit : undefined}
        isRestrictedUser={props.isRestrictedUser}
      />
      <ViewPermissionsDrawer
        open={viewPermissionsDrawer.isOpen}
        onClose={viewPermissionsDrawer.close}
        objectStorageKey={keyToEdit}
      />
      <SecretTokenDialog
        title="Access Keys"
        open={displayKeysDialog.isOpen}
        onClose={displayKeysDialog.close}
        objectStorageKey={keyToDisplay}
      />
      <RevokeAccessKeyDialog
        isOpen={revokeKeysDialog.isOpen}
        label={(keyToRevoke && keyToRevoke.label) || ''}
        handleClose={closeRevokeDialog}
        handleSubmit={handleRevokeKeys}
        isLoading={isRevoking}
        numAccessKeys={pathOr<number>(0, ['data', 'length'], paginationProps)}
        errors={revokeErrors}
      />
    </div>
  );
};

const updatedRequest = (_: CombinedProps, params: any, filters: any) =>
  getObjectStorageKeys(params, filters);

const paginated = Pagey(updatedRequest);

const enhanced = compose<CombinedProps, Props>(paginated);

export default enhanced(AccessKeyLanding);
