import Resolver from "@forge/resolver";
import api, { route } from "@forge/api";
import { CONFIGS, pick } from "./configs";

const resolver = new Resolver();

const getIssue = async (issueIdOrKey) => {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueIdOrKey}`);
  return await response.json();
};

const updateIssue = async (issueId, fields) => {
  const bodyData = {
    fields,
    update: {},
  };

  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

  console.log(
    `updateIssue Response: ${response.status} ${response.statusText}`
  );

  if (response.status !== 204) throw new Error(await response.text());
};

const createDescription = (description) => ({
  ...description,
  type: "doc",
  content: description.content.filter(
    (content) => content.type !== "mediaSingle"
  ),
});

const cloneIssue = async (issue, fields) => {
  const bodyData = {
    fields: {
      ...pick(issue.fields, [
        "assignee",
        "issuetype",
        "project",
        "summary",
        "reporter",
        "parent",
        "labels",
      ]),
      ...fields,
      description: issue.fields.description
        ? createDescription(issue.fields.description)
        : null,
    },
    update: {},
  };

  const response = await api.asApp().requestJira(route`/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  });

  console.log(`cloneIssue Response: ${response.status} ${response.statusText}`);

  if (response.status !== 201) {
    console.log(JSON.stringify(bodyData));
    throw new Error(await response.text());
  }

  return await response.json();
};

const changeStatusDoneIssue = async (issueIdOrKey) => {
  const bodyData = {
    transition: {
      id: CONFIGS.TRANSITION_TO_CLOSED,
    },
  };

  const response = await api
    .asApp()
    .requestJira(route`/rest/api/2/issue/${issueIdOrKey}/transitions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

  console.log(
    `changeStatusDoneIssue Response: ${response.status} ${response.statusText}`
  );

  if (response.status !== 204) throw new Error(await response.text());
};

const linkCloneIssueToParent = async (issueKey, parentKey) => {
  const bodyData = {
    type: { id: "10006" }, // This is id for split from
    inwardIssue: { key: parentKey },
    outwardIssue: { key: issueKey },
  };

  const response = await api.asApp().requestJira(route`/rest/api/3/issueLink`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  });

  console.log(
    `linkCloneIssueToParent Response: ${response.status} ${response.statusText}`
  );

  if (response.status !== 201) throw new Error(await response.text());
};

const handleSplit = async (issueIdOrKey: string) => {
  const issue = await getIssue(issueIdOrKey);

  const nextStoryPoint =
    issue.fields.status.name === CONFIGS.PULL_REQUEST_STATUS
      ? CONFIGS.PULL_REQUEST_POINT
      : CONFIGS.QA_POINT;

  const newStoryPoint =
    Number(issue.fields[CONFIGS.STORY_POINT_FIELD_NAME] ?? 0) - nextStoryPoint;

  if (newStoryPoint > 0) {
    const sprints = issue.fields[CONFIGS.SPRINT_FIELD_NAME];
    const activeSprint = sprints?.find(
      (sprint) => sprint.state === "active"
    )?.id;

    const cloned = await cloneIssue(issue, {
      ...(!issue.fields.issuetype.subtask && {
        // Note this is a subtask and subtasks cannot be associated to a sprint. It's associated to the same sprint as its parent.
        [CONFIGS.SPRINT_FIELD_NAME]: activeSprint,
      }),
      [CONFIGS.STORY_POINT_FIELD_NAME]: newStoryPoint,
      summary: `${issue.fields.summary} - SPLIT`,
    });

    await changeStatusDoneIssue(cloned.id);
    await linkCloneIssueToParent(cloned.key, issueIdOrKey);
  }

  await updateIssue(issue.id, {
    [CONFIGS.STORY_POINT_FIELD_NAME]: nextStoryPoint,
  });
};

resolver.define("event-listener", async ({ payload, context }) => {
  const { issueIdOrKeys } = payload;
  console.log("consumer start", issueIdOrKeys);
  try {
    await handleSplit(issueIdOrKeys);
    console.log("consumer completed", issueIdOrKeys);
  } catch (e) {
    console.error(e);
  }
});

export const handler = resolver.getDefinitions();
