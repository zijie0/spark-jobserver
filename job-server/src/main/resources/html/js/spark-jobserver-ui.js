function showJobs(filter,$tableBody,allowKill) {
    $.getJSON(
        'jobs',
        filter,
        function(jobs) {
            $tableBody.html("");
            var jobsHtml = "";
            $.each(jobs, function(key, job) {
                jobsHtml += "<tr>";
                jobsHtml += "<td><a href='./jobs/" + job.jobId + "'>" + job.jobId + "</a> (<a href='./jobs/" + job.jobId + "/config'>C</a>)</td>";
                jobsHtml += "<td>" + job.classPath + "</td>";
                jobsHtml += "<td>" + job.context + "</td>";
                jobsHtml += "<td>" + job.startTime + "</td>";
                jobsHtml += "<td>" + job.duration + "</td>";
                if (allowKill) {
                    jobsHtml += "<td><a href='#' id=" + job.jobId + " onclick='deleteJob(this.id);return false;'>kill</a></td>";
                }
                jobsHtml += "</tr>";
            });
            $tableBody.html(jobsHtml);
        });
}

function getJobs() {
    //show error jobs
    showJobs({status:"error"},$('#failedJobsTable > tbody:last'), false);
    //show running jobs
    showJobs({status:"running"},$('#runningJobsTable > tbody:last'), true);
    //show complete jobs
    showJobs({status:"finished"},$('#completedJobsTable > tbody:last'), false);
}

function getContexts() {
    $.getJSON(
        'contexts',
        '',
        function(contexts) {
            $('#contextsTable tbody').empty();

            $.each(contexts, function(key, contextName) {
                var items = [];
                items.push("<tr><td>" + contextName + "</td></tr>");
                $('#contextsTable > tbody:last').append(items.join(""));
            });
        });
}

function deleteJob(jobID) {
    var deleteURL = "./jobs/" + jobID;

    $.ajax ({
        type: 'DELETE',
        url: deleteURL
    })
        .done(function( responseText) {
            alert( "Killed job: " + jobID + "\n" + JSON.stringify(responseText) );
            window.location.reload(true);
        })
        .fail(function( jqXHR ) {
            alert( "Failed killing job: " + jobID + "\n" + JSON.stringify(jqXHR.responseJSON) );
        });
}

function getJars() {
    $.getJSON(
        'jars',
        '',
        function(jars) {
            $('#jarsTable tbody').empty();

            $.each(jars, function(jarName, deploymentTime) {
                var items = [];
                items.push("<tr>");
                items.push("<td>" + jarName + "</td>");
                items.push("<td>" + deploymentTime + "</td>");
                items.push("</tr>");
                $('#jarsTable > tbody:last').append(items.join(""));
            });
        });
}


$(function () {
    $('#navTabs a[data-toggle="tab"]').on('show.bs.tab', function (e) {
        var target = $(e.target).attr("href");

        if (target == '#jobs') {
            getJobs();
        } else if (target == "#contexts") {
            getContexts();
        } else {
            getJars();
        }
    })
    getJobs();
});
