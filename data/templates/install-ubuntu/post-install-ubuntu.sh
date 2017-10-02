#!/bin/bash

# create SSH key for root
<% if ('undefined' !== typeof rootSshKey && null !== rootSshKey) { -%>
mkdir /root/.ssh
echo <%=rootSshKey%> > /root/.ssh/authorized_keys
chown -R root:root /root/.ssh
<% } -%>

# create users and SSH key for users
<% if (typeof users !== 'undefined') { -%>
<% users.forEach(function(user) { -%>
    <%_ if (undefined !== user.uid) { _%>
        useradd -u <%=user.uid%> -m -p '<%=user.encryptedPassword%>' <%=user.name%>
    <%_ } else {_%>
        useradd -m -p '<%=user.encryptedPassword%>' <%=user.name%>
    <%_ } _%>
    <%_ if (undefined !== user.sshKey) { _%>
mkdir /home/<%=user.name%>/.ssh
echo <%=user.sshKey%> > /home/<%=user.name%>/.ssh/authorized_keys
chown -R <%=user.name%>:<%=user.name%> /home/<%=user.name%>/.ssh
    <%_ } _%>
<% }); -%>
<% } -%>
