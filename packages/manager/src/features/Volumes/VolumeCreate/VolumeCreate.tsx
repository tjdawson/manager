import { Grant } from '@linode/api-v4/lib/account';
import { pathOr } from 'ramda';
import * as React from 'react';
import { connect, MapDispatchToProps } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import BreadCrumb from 'src/components/Breadcrumb';
import { makeStyles, Theme } from 'src/components/core/styles';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import { isRestrictedUser } from 'src/features/Profile/permissionsHelpers';
import { useRegionsQuery } from 'src/queries/regions';
import { MapState } from 'src/store/types';
import { openForConfig, viewResizeInstructions } from 'src/store/volumeForm';
import CreateVolumeForm from './CreateVolumeForm';

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    [theme.breakpoints.down('xs')]: {
      marginLeft: theme.spacing(),
    },
  },
}));

interface StateProps {
  mode: string;
  volumeId?: number;
  volumeLabel?: string;
  volumeRegion?: string;
  volumeSize?: number;
  volumeTags?: string[];
  volumePath?: string;
  linodeId?: number;
  linodeLabel?: string;
  linodeRegion?: string;
  message?: string;
  readOnly?: boolean;
}

interface DispatchProps {
  actions: {
    openForConfig: (
      volumeLabel: string,
      volumePath: string,
      message?: string
    ) => void;
    openForResizeInstructions: (volumeLabel: string, message?: string) => void;
  };
}

const mapDispatchToProps: MapDispatchToProps<DispatchProps, {}> = (
  dispatch
) => ({
  actions: {
    openForConfig: (
      volumeLabel: string,
      volumePath: string,
      message?: string
    ) => dispatch(openForConfig(volumeLabel, volumePath, message)),
    openForResizeInstructions: (volumeLabel: string, message?: string) =>
      dispatch(viewResizeInstructions({ volumeLabel, message })),
  },
});

type CombinedProps = StateProps & RouteComponentProps<{}> & DispatchProps;

const VolumeCreate: React.FC<CombinedProps> = (props) => {
  const classes = useStyles();
  const regions = useRegionsQuery().data ?? [];

  const { actions, history } = props;

  return (
    <>
      <DocumentTitleSegment segment="Create Volume" />
      <BreadCrumb
        className={classes.title}
        labelTitle="Create"
        pathname={props.location.pathname}
      />
      <CreateVolumeForm
        onSuccess={actions.openForConfig}
        regions={regions}
        history={history}
      />
    </>
  );
};

const mapStateToProps: MapState<StateProps, {}> = (state) => {
  const {
    linodeId,
    linodeLabel,
    linodeRegion,
    mode,
    volumeId,
    volumeLabel,
    volumeRegion,
    volumeSize,
    volumeTags,
    volumePath,
    message,
  } = state.volumeDrawer;

  const volumesPermissions = pathOr(
    [],
    ['__resources', 'profile', 'data', 'grants', 'volume'],
    state
  );
  const volumePermissions = volumesPermissions.find(
    (v: Grant) => v.id === volumeId
  );

  return {
    linode_id: linodeId,
    linodeLabel,
    linodeRegion,
    mode,
    volumeId,
    volumeLabel,
    volumeRegion,
    volumeSize,
    volumeTags,
    volumePath,
    message,
    readOnly:
      isRestrictedUser(state) &&
      volumePermissions &&
      volumePermissions.permissions === 'read_only',
  };
};

const connected = connect(mapStateToProps, mapDispatchToProps);

export default connected(VolumeCreate);
