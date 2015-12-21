var $ = require('jquery');
var _ = require('underscore');
var vent = require('vent');
var Marionette = require('marionette');
var Backgrid = require('backgrid');
var MissingCollection = require('./MissingCollection');
var SelectAllCell = require('Cells/SelectAllCell');
var SeriesTitleCell = require('Cells/SeriesTitleCell');
var EpisodeNumberCell = require('Cells/EpisodeNumberCell');
var EpisodeTitleCell = require('Cells/EpisodeTitleCell');
var RelativeDateCell = require('Cells/RelativeDateCell');
var EpisodeStatusCell = require('Cells/EpisodeStatusCell');
var GridPager = require('Shared/Grid/Pager');
var LoadingView = require('Shared/LoadingView');
var Messenger = require('Shared/Messenger');
var CommandController = require('Commands/CommandController');

require('backgrid.selectall');
require('Mixins/backbone.signalr.mixin');

module.exports = Marionette.Layout.extend({
  template: 'Wanted/Missing/MissingLayoutTemplate',

  regions: {
    missing: '#x-missing',
    pager: '#x-pager'
  },

  ui: {
    searchSelectedButton: '.btn i.icon-sonarr-search'
  },

  columns: [
    {
      name: '',
      cell: SelectAllCell,
      headerCell: 'select-all',
      sortable: false
    },
    {
      name: 'series',
      label: 'Series Title',
      cell: SeriesTitleCell,
      sortValue: 'series.sortTitle'
    },
    {
      name: 'this',
      label: 'Episode',
      cell: EpisodeNumberCell,
      sortable: false
    },
    {
      name: 'this',
      label: 'Episode Title',
      cell: EpisodeTitleCell,
      sortable: false
    },
    {
      name: 'airDateUtc',
      label: 'Air Date',
      cell: RelativeDateCell
    },
    {
      name: 'status',
      label: 'Status',
      cell: EpisodeStatusCell,
      sortable: false
    }
  ],

  initialize: function() {
    this.collection = new MissingCollection().bindSignalR({ updateOnly: true });

    this.listenTo(this.collection, 'sync', this._showTable);
    this._showActionBar();
  },

  onShow: function() {
    this.missing.show(new LoadingView());
    this.collection.fetch();
  },

  _showTable: function() {
    this.missingGrid = new Backgrid.Grid({
      columns: this.columns,
      collection: this.collection,
      className: 'table table-hover'
    });

    this.missing.show(this.missingGrid);

    this.pager.show(new GridPager({
      columns: this.columns,
      collection: this.collection
    }));
  },

  _showActionBar: function() {
    var actions = {
      type: 'default',
      collapse: true,
      items: [
        {
          tooltip: 'Search Selected',
          icon: 'icon-sonarr-search',
          callback: this._searchSelected
        },
        {
          tooltip: 'Search All Missing',
          icon: 'icon-sonarr-search',
          callback: this._searchMissing
        },
        {
          title: 'Toggle Selected',
          icon: 'icon-sonarr-monitored',
          tooltip: 'Toggle monitored status of selected',
          callback: this._toggleMonitoredOfSelected
        },
        {
          tooltip: 'Rescan Drone Factory Folder',
          icon: 'icon-sonarr-refresh',
          command: 'downloadedepisodesscan',
          properties: { sendUpdates: true }
        },
        {
          tooltip: 'Manual Import',
          icon: 'icon-sonarr-search-manual',
          callback: this._manualImport
        }
      ]
    };

    var filteringOptions = {
      storeState: false,
      menuKey: 'wanted.filterMode',
      defaultAction: 'monitored',
      items: [
        {
          key: 'monitored',
          title: 'Monitored Only',
          icon: 'icon-sonarr-monitored'
        },
        {
          key: 'unmonitored',
          title: 'Unmonitored Only',
          icon: 'icon-sonarr-unmonitored'
        }
      ]
    };

    vent.trigger(vent.Commands.OpenActionBarCommand, {
      parentView: this,
      collection: this.collection,
      actions: actions,
      filtering: filteringOptions
    });
  },

  _setFilter: function(buttonContext) {
    var mode = buttonContext.model.get('key');
    this.collection.state.currentPage = 1;
    var promise = this.collection.setFilterMode(mode);
    if (buttonContext) {
      buttonContext.ui.icon.spinForPromise(promise);
    }
  },

  _searchSelected: function() {
    var selected = this.missingGrid.getSelectedModels();
    if (selected.length === 0) {
      Messenger.show({
        type: 'error',
        message: 'No episodes selected'
      });
      return;
    }
    var ids = _.pluck(selected, 'id');
    CommandController.Execute('episodeSearch', {
      name: 'episodeSearch',
      episodeIds: ids
    });
  },

  _searchMissing: function() {
    if (window.confirm('Are you sure you want to search for {0} missing episodes? '.format(this.collection.state.totalRecords) +
        'One API request to each indexer will be used for each episode. ' + 'This cannot be stopped once started.')) {
      CommandController.Execute('missingEpisodeSearch', { name: 'missingEpisodeSearch' });
    }
  },

  _toggleMonitoredOfSelected: function() {
    var selected = this.missingGrid.getSelectedModels();

    if (selected.length === 0) {
      Messenger.show({
        type: 'error',
        message: 'No episodes selected'
      });
      return;
    }

    var promises = [];
    var self = this;

    _.each(selected, function(episode) {
      episode.set('monitored', !episode.get('monitored'));
      promises.push(episode.save());
    });

    $.when(promises).done(function() {
      self.collection.fetch();
    });
  },

  _manualImport: function() {
    vent.trigger(vent.Commands.ShowManualImport);
  }
});