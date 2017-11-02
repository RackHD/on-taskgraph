'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess

from nosedep import depends

import test_common

# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_post_get_delete_workflows(test_common.unittest.TestCase):
    def test_api_20_workflows(self):
        data_payload = {
            "name": "Graph.noop-example",
            "options": {
                "defaults": {
                    "graphOptions": {
                        "target": None
                    }
                }
            }
        }
        graph_uui = None

        api_data = test_common.taskgraphapi("/api/2.0/workflows", action="post", payload=data_payload)
        graph_uui = api_data['json']['context']['graphId']
        self.assertEqual(api_data['status'], 201,
                         'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))

        api_data = test_common.taskgraphapi("/api/2.0/workflows")
        self.assertEqual(api_data['status'], 200, 'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        for item in api_data['json']:
            # check required fields
            for subitem in ["id", "name","injectableName", "instanceId", "tasks", "context"]:
                self.assertIn(subitem, item, subitem + ' field error')


        api_data = test_common.taskgraphapi("/api/2.0/workflows/" + graph_uui, action="delete")
        self.assertEqual(api_data['status'], 403,
                         'Incorrect HTTP return code, expected 403, got:' + str(api_data['status']))

    def test_api_20_workflows_action(self):
        data_payload = {
            "name": "Graph.noop-example",
            "options": {
                "defaults": {
                    "graphOptions": {
                        "target": None
                    },
                    "delay":10000
                }
            }
        }
        cancel_payload = {
            "command":"cancel"
        }

        graph_uui = None
        api_data = test_common.taskgraphapi("/api/2.0/workflows", action="post", payload=data_payload)
        graph_uui = api_data['json']['context']['graphId']

        api_data = test_common.taskgraphapi("/api/2.0/workflows/"+graph_uui+"/action", action="put", payload=cancel_payload)
        self.assertEqual(api_data['status'], 202,
                         'Incorrect HTTP return code, expected 202, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/" + graph_uui , action="get")
        self.assertEqual(api_data['json']['_status'], "cancelled",
                         'Incorrect HTTP return code, expected cancelled, got:' + str(api_data['json']['_status']))

    def test_api_20_workflows_put_get_delete_tasks(self):
        data_payload = {
            "friendlyName": "Shell commands hwtest",
            "injectableName": "Task.Linux.Commands.Hwtest",
            "implementsTask": "Task.Base.Linux.Commands",
            "options": {
                "commands": [
                    {"command": "sudo /opt/test/hwtest",
                     "format": "json", "source": "hwtest"}
                ]
            },
            "properties": {"type": "hwtestRun"}
        }
        api_data = test_common.taskgraphapi("/api/2.0/workflows/tasks", action="put", payload=data_payload)
        self.assertEqual(api_data['status'], 201, 'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/tasks", action="get", payload=data_payload)
        self.assertEqual(api_data['status'], 200,'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        for item in api_data['json']:
        # check required fields
            for subitem in ["friendlyName", "injectableName", "implementsTask", "options", "properties"]:
                self.assertIn(subitem, item, subitem + ' field error')

    @depends(after=test_api_20_workflows_put_get_delete_tasks)
    def test_api_20_workflows_put_get_delete_tasks_WithInjectableName(self):
        api_data = test_common.taskgraphapi("/api/2.0/workflows/tasks/Task.Linux.Commands.Hwtest", action="get")
        self.assertEqual(api_data['status'], 200,
                         'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/tasks/Task.Linux.Commands.Hwtest", action="delete")
        self.assertEqual(api_data['status'], 204,
                         'Incorrect HTTP return code, expected 204, got:' + str(api_data['status']))

    def test_api_20_workflows_put_get_delete_graph(self):
        data_payload = \
            {
                "friendlyName": "TestIPMI",
                "injectableName": 'Graph.Obm.Ipmi.CreateSettings.Test',
                "options": {
                    "obm-ipmi-task":{
                        "user": "rackhd",
                        "password": "rackhd"
                    }
                },
                "tasks": [
                    {
                        "label": "obm-ipmi-task",
                        "taskName": "Task.Obm.Ipmi.CreateSettings"
                    }
            ]
        }
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs", action="put", payload=data_payload)
        self.assertEqual(api_data['status'], 201, 'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs/" + 'Graph.Obm.Ipmi.CreateSettings.Test')
        self.assertEqual(api_data['status'], 200, 'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs/" + 'Graph.Obm.Ipmi.CreateSettings.Test', action="delete")
        self.assertEqual(api_data['status'], 204, 'Incorrect HTTP return code, expected 204, got:' + str(api_data['status']))

    def test_api_20_workflows_graphs_get(self):
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs")
        self.assertEqual(api_data['status'], 200,
                         'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        for item in api_data['json']:
            # check required fields
            for subitem in ["friendlyName", "injectableName", "tasks"]:
                self.assertIn(subitem, item, subitem + ' field error')


if __name__ == '__main__':
    test_common.unittest.main()
