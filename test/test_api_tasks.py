'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess
import test_common
from pymongo import MongoClient
from bson.objectid import ObjectId

# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_tasks(test_common.unittest.TestCase):

    def test_api_20_tasks_bootstraps(self):
        node = {
            "identifiers": ["ff:ff:ff:ff:ff:ff"],
            "name": "NodeName",
            "relations": [],
            "tags": [],
            "type": "compute"
        }

        lookup = {
            "node": None,
            "macAddress": "ff:ff:ff:ff:ff:ff",
            "ipAddress": "127.0.0.1"
        }

        client = MongoClient('127.0.0.1', 27017)
        db = client.pxe

        insertedNode = db.nodes.insert(node)
        lookup["node"] = ObjectId(insertedNode)
        insertedLookup = db.lookups.insert(lookup)
        computeNode = db.nodes.find_one({"_id": insertedNode})
        mac = computeNode["identifiers"][0]

        #Expecting a valid content
        api_data = test_common.taskgraphapi("/api/2.0/tasks/bootstrap.js"+"?macAddress=" + mac)
        self.assertEqual(api_data['status'], 200, "Was expecting code 200. Got " + str(api_data['status']))
        self.assertNotEqual(api_data['text'], "Not Found", "Was expecting a valid content")

        # Expecting an invalid content
        api_data = test_common.taskgraphapi("/api/2.0/tasks/invalidContent"+"?macAddress=" + mac)
        self.assertEqual(api_data['status'], 404, "Was expecting code 404. Got " + str(api_data['status']))

        db.nodes.remove({"_id": insertedNode})
        db.lookups.remove({"_id": insertedLookup})

    def test_api_20_tasks_identifier(self):
        api_data = test_common.taskgraphapi("/api/2.0/tasks/InvalidTaskID")
        self.assertEqual(api_data['status'], 404, "Was expecting code 404. Got " + str(api_data['status']))

if __name__ == '__main__':
    test_common.unittest.main()
