/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  class MemoryComponents extends cp.ElementBase {
    static get template() {
      return Polymer.html`
        <style>
          :host {
            display: flex;
          }

          .column {
            border-bottom: 1px solid var(--primary-color-dark, blue);
            margin-bottom: 4px;
            max-height: 143px;
            overflow-y: auto;
          }
        </style>

        <template is="dom-repeat" items="[[columns]]" as="column"
                                  index-as="columnIndex">
          <div class="column">
            <option-group
                state-path="[[statePath]].columns.[[columnIndex]]"
                root-state-path="[[statePath]].columns.[[columnIndex]]"
                on-option-select="onColumnSelect_">
            </option-group>
          </div>
        </template>
      `;
    }

    async onColumnSelect_(event) {
      await this.dispatch('onColumnSelect', this.statePath);
      this.dispatchEvent(new CustomEvent('option-select', {
        bubbles: true,
        composed: true,
      }));
    }

    async observeOptions_(options, selectedOptions) {
      this.dispatch('buildColumns', this.statePath);
    }
  }

  MemoryComponents.State = {
    ...cp.OptionGroup.RootState,
    ...cp.OptionGroup.State,
    columns: options => MemoryComponents.buildColumns(
        options.options || [], options.selectedOptions || []),
  };

  MemoryComponents.buildState = options => cp.buildState(
      MemoryComponents.State, options);

  MemoryComponents.properties = {
    ...cp.buildProperties('state', MemoryComponents.State),
  };

  MemoryComponents.observers = [
    'observeOptions_(options, selectedOptions)',
  ];

  MemoryComponents.actions = {
    buildColumns: statePath => async(dispatch, getState) => {
      if (!Polymer.Path.get(getState(), statePath)) return;
      dispatch({
        type: MemoryComponents.reducers.buildColumns.name,
        statePath,
      });
    },

    onColumnSelect: statePath => async(dispatch, getState) => {
      dispatch({
        type: MemoryComponents.reducers.onColumnSelect.name,
        statePath,
      });
    },
  };

  MemoryComponents.buildColumns = (options, selectedOptions) => {
    if (!options || !options.length ||
        !selectedOptions || !selectedOptions.length) {
      return [];
    }
    const columnOptions = [];
    for (const option of options) {
      for (const name of cp.OptionGroup.getValuesFromOption(option)) {
        const columns = MemoryComponents.parseColumns(name);
        while (columnOptions.length < columns.length) {
          columnOptions.push(new Set());
        }
        for (let i = 0; i < columns.length; ++i) {
          columnOptions[i].add(columns[i]);
        }
      }
    }

    const selectedColumns = [];
    while (selectedColumns.length < columnOptions.length) {
      selectedColumns.push(new Set());
    }
    for (const name of selectedOptions) {
      const columns = MemoryComponents.parseColumns(name);
      if (columns.length > selectedColumns.length) return [];
      for (let i = 0; i < columns.length; ++i) {
        selectedColumns[i].add(columns[i]);
      }
    }

    return columnOptions.map((options, columnIndex) => {
      return {
        options: cp.OptionGroup.groupValues([...options].sort()),
        selectedOptions: [...selectedColumns[columnIndex]],
      };
    });
  };

  MemoryComponents.reducers = {
    buildColumns: (state, action, rootState) => {
      if (!state) return state;
      return {
        ...state,
        columns: MemoryComponents.buildColumns(
            state.options, state.selectedOptions),
      };
    },

    onColumnSelect: (state, action, rootState) => {
      // Remove all memory measurements from state.selectedOptions
      const selectedOptions = state.selectedOptions.filter(v =>
        !v.startsWith('memory:'));

      // Add all options whose columns are all selected.
      const selectedColumns = state.columns.map(column =>
        column.selectedOptions);
      for (const option of state.options) {
        for (const value of cp.OptionGroup.getValuesFromOption(option)) {
          if (MemoryComponents.allColumnsSelected(value, selectedColumns)) {
            selectedOptions.push(value);
          }
        }
      }

      return {...state, selectedOptions};
    },
  };

  MemoryComponents.parseColumns = name => {
    // See getNumericName in memoryMetric:
    // /tracing/tracing/metrics/system_health/memory_metric.html
    const parts = name.split(':');
    if (parts[0] !== 'memory') return [];
    if (parts.length < 5) return [];

    const browser = parts[1];
    let process = parts[2].replace(/_processe?/, '');
    if (process === 'alls') process = 'all';
    const source = parts[3].replace(/^reported_/, '');
    let component = parts.slice(4, parts.length - 1).join(':').replace(
        /system_memory/, 'system');
    if (!component) component = 'overall';
    const size = parts[parts.length - 1].replace(/_size(_\w)?$/, '');
    return [browser, process, source, component, size];
  };

  MemoryComponents.allColumnsSelected = (name, selectedColumns) => {
    const columns = MemoryComponents.parseColumns(name);
    if (columns.length === 0) return false;
    for (let i = 0; i < columns.length; ++i) {
      if (!selectedColumns[i].includes(columns[i])) return false;
    }
    return true;
  };

  cp.ElementBase.register(MemoryComponents);
  return {MemoryComponents};
});
