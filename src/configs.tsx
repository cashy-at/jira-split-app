export const CONFIGS = {
  QUEUE_KEY: "split-tasks-queue",
  CASHY_BOARD_ID: 2,
  TRANSITION_TO_CLOSED: "51",
  SPRINT_FIELD_NAME: "customfield_10020",
  STORY_POINT_FIELD_NAME: 'customfield_10024',
  PULL_REQUEST_STATUS: "Pull Request",
  QA_POINT: 0.5,
  PULL_REQUEST_POINT: 1,
  // For testing
  // CASHY_BOARD_ID: 6,
  // TRANSITION_TO_CLOSED: "31",
  // STORY_POINT_FIELD_NAME: "customfield_10016",
};

export const pick = (obj, keys) =>
  keys
    .map((k) => (k in obj ? { [k]: obj[k] } : {}))
    .reduce((res, o) => Object.assign(res, o), {});
