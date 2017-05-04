//http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters

var QueryString = function () {
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split('=');
        if (typeof query_string[pair[0]] === 'undefined') {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
        } else if (typeof query_string[pair[0]] === 'string') {
            query_string[pair[0]] = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();

var generateUrl = function (params) {
    var values = [];
    Object.keys(params).map(function(attribute) {
        values.push(attribute + '=' + params[attribute]);
    });

    return window.location.href + '?' + values.join('&');
};
