import ForgeUI, { render, ProjectPage, Fragment, Text, ModalDialog, useState, Form, Table, Head, Cell, Row, Image, Heading, Button, Select, Option } from "@forge/ui";
import api, { route } from "@forge/api";
import { Queue } from '@forge/events';
import { CONFIGS, pick } from './configs'

const queue = new Queue({ key: CONFIGS.QUEUE_KEY });

const searchIssues = async (sprintId) => {
  const bodyData = {
    jql: `status in ("Pull Request", QA, QA-DEV) and sprint = ${sprintId}`,
    maxResults: 999,
  }

  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/search`, {
      method: "POST",
      body: JSON.stringify(bodyData),
    });

  const data = await res.json();

  return data.issues;
};

const getBoardSprints = async (boardId) => {
  const response = await api.asUser().requestJira(route`/rest/agile/1.0/board/${boardId}/sprint?state=active,future`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  return (await response.json()).values.map(sprint => ({
    id: sprint.id,
    name: sprint.name,
    state: sprint.state,
  }));
}

const App = () => {
  const [issues, setIssues] = useState();
  const [nextSprintId, setNextSprintId] = useState();;
  const [isConfirm, setConfirm] = useState(false);
  const [isCompleted, setCompleted] = useState(false);
  const [sprints] = useState(async () => await getBoardSprints(CONFIGS.CASHY_BOARD_ID));

  const activeSprint = sprints?.find(sprint => sprint.state === 'active')
  const activeSprintNumber = Number(activeSprint?.name?.match(/\d+/)?.[0])
  const suggestNextSprintId = activeSprintNumber && sprints?.find(sprint => sprint.state === 'future' && Number(sprint.name?.match(/\d+/)?.[0]) === activeSprintNumber + 1)?.id

  const handleSubmit = async (v) => {
    setNextSprintId(v.nextSprint)
    const data = await searchIssues(v.targetSprint)
    setIssues(data
      .filter(issue =>
        issue.fields.status.name === CONFIGS.PULL_REQUEST_STATUS
          ? issue.fields[CONFIGS.STORY_POINT_FIELD_NAME] > CONFIGS.PULL_REQUEST_POINT
          : issue.fields[CONFIGS.STORY_POINT_FIELD_NAME] > CONFIGS.QA_POINT)
      .map(issue => ({
        key: issue.key,
        fields: pick(issue.fields, [
          'issuetype',
          'summary',
          'status',
          'assignee',
          CONFIGS.STORY_POINT_FIELD_NAME,
        ]),
      })))
  }


  const handleConfirmSplit = () => {
    setConfirm(true)
  }

  const handleConfirmSplitTask = async ({ issueIds }) => {
    setConfirm(false)
    const keyPayloads = issueIds.map(issueId => ({ issueIdOrKeys: issueId }))
    queue.push(keyPayloads);
    setCompleted(true)
  }

  const actionsButtons = [
    <Button text="Split tasks" onClick={handleConfirmSplit} disabled={!nextSprintId} />
  ]

  return (
    <Fragment>
      <Form onSubmit={handleSubmit} submitButtonAppearance="default" submitButtonText="Search" actionButtons={actionsButtons}>
        <Select label="Target sprint" name="targetSprint" isRequired>
          {sprints
            ?.filter(sprint => sprint.state === 'active')
            ?.map(sprint => (
              <Option defaultSelected={sprint.state === 'active'} label={sprint.name} value={sprint.id} key={sprint.id} />
            ))}
        </Select>

        <Select label="Next sprint" name="nextSprint" isRequired>
          {sprints
            ?.filter(sprint => sprint.state !== 'active')
            ?.map(sprint => (
              <Option defaultSelected={sprint.id === suggestNextSprintId} label={sprint.name} value={sprint.id} key={sprint.id} />
            ))}
        </Select>

      </Form>


      {!!issues?.length && (
        <Fragment>
          <Heading>Total {issues?.length} issues</Heading>
          <Table>
            <Head>
              <Cell>
                <Text>Type</Text>
              </Cell>
              <Cell>
                <Text>Issue</Text>
              </Cell>
              <Cell>
                <Text>Summary</Text>
              </Cell>
              <Cell>
                <Text>Status</Text>
              </Cell>
              <Cell>
                <Text>Story Point</Text>
              </Cell>
              <Cell>
                <Text>Assignee</Text>
              </Cell>
            </Head>
            {issues?.map(issue => (
              <Row key={issue.key}>
                <Cell>
                  <Image src={issue.fields.issuetype.iconUrl} size="xsmall" />
                </Cell>
                <Cell>
                  <Text>
                    {issue.key}
                  </Text>
                </Cell>
                <Cell>
                  <Text>{issue.fields.summary}</Text>
                </Cell>
                <Cell>
                  <Text>{issue.fields.status.name}</Text>
                </Cell>
                <Cell>
                  <Text>{issue.fields[CONFIGS.STORY_POINT_FIELD_NAME]}</Text>
                </Cell>
                <Cell>
                  <Text>{issue.fields.assignee?.displayName}</Text>
                </Cell>
              </Row>
            ))}
          </Table>
        </Fragment>
      )}

      <ConfirmModal issues={issues} isOpen={isConfirm} onClose={() => setConfirm(false)} onConfirm={handleConfirmSplitTask} />

      <CompletedModal isOpen={isCompleted} onClose={() => setCompleted(false)} />
    </Fragment>
  );
};

const ConfirmModal = ({ issues, isOpen, onClose, onConfirm }) => {
  return (
    <Fragment>
      {
        isOpen && (
          <ModalDialog header="Confirm to split tasks" onClose={onClose} width="large">
            <Form onSubmit={onConfirm}>
              <Select label="Issues" name="issueIds" isMulti>
                {issues.map(issue => <Option defaultSelected label={issue.key + ' ' + issue.fields.summary} key={issue.key} value={issue.key} />)}
              </Select>
            </Form>
          </ModalDialog>
        )
      }
    </Fragment>
  )
}

const CompletedModal = ({ isOpen, onClose }) => {
  return (
    <Fragment>
      {
        isOpen && (
          <ModalDialog header="Split tasks completed" onClose={onClose} />
        )
      }
    </Fragment>
  )
}

export const run = render(
  <ProjectPage>
    <App />
  </ProjectPage>
);
