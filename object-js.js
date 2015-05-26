if (typeof OBJECTJS !== 'object') {
    OBJECTJS = {};
}
(function(packObj){
	var tokenType = {DEFAULT:0, NUMBER:1, DECIMAL:2, USERWORD:3, SIGN:4, KEYWORD:5, STRING:6};
	var scopeType = {DEFAULT:2, PUBLIC:1, PRIVATE:2, PROTECTED:3};
	var memberType = {FUNCTION:1, PROPERTY:2};
	var classes = {};

	function throwError(token, msg){
		var errorMsg = "";
		throw new Error("lineNo:"+token.line+" msg:"+msg+" token:"+token.value);
	}

	function isArray(obj) { 
		return Object.prototype.toString.call(obj) === '[object Array]'; 
	}

	function symbolMatch(token, signQ){
		if (token.value == '...') throwError(token, "18");
		if (token.value == '[' || token.value == '(' || token.value == '{') {
			signQ.push(token.value);
		}
		else if(token.value == ']' || token.value == ')' || token.value == '}') {
			var tempSign = signQ.pop();
			if ((token.value == ']' && tempSign !='[') || (token.value == ')' && tempSign !='(') || (token.value == '}' && tempSign !='{')) {
				throwError(token, "98");
			}
		}
	}

	//扫描程序，生成token
	function scanner(content) {
		var number = "0123456789", number_x16 = number + "ABCDEFabcef", letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$", 
			blank = " \t\r\n", alnum = letter + number, sgin = "~!%^&*()-+={}[]|:;<>,.?/";
		var sgins = {"=":{"=":{"=":{}}},".":{".":{".":{}}},"!":{"=":{"=":{}}},"*":{"=":{}},"/":{"=":{}},"%":{"=":{}},"^":{"=":{}},
		"+":{"+":{},"=":{}},"-":{"-":{},"=":{},">":{}},"&":{"&":{},"=":{}},"|":{"|":{},"=":{}},
			"<":{"=":{},"<":{"=":{}}},">":{"=":{},">":{"=":{},">":{"=":{}}}}};
		var keyword={"break":1,"case":2,"catch":3,"class":4,"continue":5,"debugger":6,"default":7,"delete":8,
		"do":9,"else":10,"extends":11,"false":12,"finally":13,"for":14,"function":15,"if":16,"import":17,
		"in":18,"instanceof":19,"new":20,"null":21,"private":22,"protected":23,"public":24,"return":25,"static":26,"switch":27,
		"this":28,"throw":29,"true":30,"try":31,"typeof":32,"var":33,"void":34,"while":35,"with":36};
		var lamdaStatusType = {close:0, start:1, single:2};
		var tokens = [],signQ = [],lineNo = 1, lamdaStatus = lamdaStatusType.close,token = prevToken = {};
		var contentLen = content.length;

		for (i = 0; i < contentLen; i++) {
			var b = content.charAt(i), nb = (i < contentLen-1)? content.charAt(i+1):'';
			token = {};
			//多行注释
			if (b=='/' && nb =='*') {
				for (i += 2; i < contentLen; i++) {
					var cb = content.charAt(i);
					if (cb == "\n") { 
						lineNo++; 
						continue;
					}
					if (cb == '*' && content.charAt(i + 1) =='/')
						break;
				}
				i++;
				continue;
			}
			//单行注释
			if (b=='/' && nb =='/') {
				for (i += 2; i < contentLen; i++) {
					if (content.charAt(i) == "\n") {
						lineNo++;
						break;
					}
				}
				continue;
			}
			//空白字符
			if (blank.indexOf(b) > -1) {
				if (b == "\n")
					lineNo++;
				continue;
			}
			token.value = b;
			token.line = lineNo;
			//辨别数字,16进制整数
			if(b=='0' && (nb=='x' || nb=='X') && number_x16.indexOf(content.charAt(i+2))>-1){
				token.type = tokenType.NUMBER;
				token.value += nb;
				for (i+=2; i < contentLen; i++) {
					b =  content.charAt(i);
					if (number_x16.indexOf(b)<0){
						throwError(token, "21");
					}
					token.value += b;
					if (alnum.indexOf(content.charAt(i+1)) < 0){
						break;
					} 
				}
			}
			//辨别数字,10进制或8进制整数或小数
			else if(number.indexOf(b) > -1 || (b=='.' && number.indexOf(nb) > -1)) {
				token.type = tokenType.NUMBER;
				var isDecimal = false;
				if (b == '.')
					isDecimal = true;
				if (number.indexOf(nb) > -1 || nb == '.') {
					for (i++; i < contentLen; i++) {
						b = content.charAt(i);
						if (number.indexOf(b) < 0 && b != '.'){
							throwError(token, "20");
						}
						if (b == '.') {
							if(!isDecimal)
								isDecimal = true;
							else
								throwError(token, "20");
						}
						token.value += b;
						nb = content.charAt(i+1);
						if (nb != '.' && alnum.indexOf(nb) < 0){
							break;
						}
					}
				} else if(letter.indexOf(nb) > -1){
					throwError(token, "20");
				}
			}
			//辨别字符串或正则表达式
			else if (b == "'" || b == '"' || (b == '/' && (prevToken.value == '(' || prevToken.value == '=' || prevToken.value == ','))) { 
				token.type = tokenType.STRING;
				var escapeCount = 0;
				for (i++; i < contentLen; i++) {
					cb = content.charAt(i);
					if (cb == "\n") {
						lineNo++; 
						token.line = lineNo;
						if(content.charAt(i-1)=="\\")
							token.value+="\\";
						token.value += "\\n";
					}else{
						token.value += cb;
					}
					if (cb == b && escapeCount % 2 == 0)
						break;
					if (cb == '\\')
						escapeCount++; 
					else
						escapeCount = 0;
				}
			}
			//处理符号
			else if (sgin.indexOf(b) > -1) {
				token.type = tokenType.SIGN;
				var tsgin = sgins[b];
				if(tsgin && tsgin[nb]){
					for (i++;i < contentLen;i++){
						b = content.charAt(i);
						token.value += b;
						tsgin = tsgin[b];
						if(!tsgin[content.charAt(i+1)]){
							break;
						}
					}
				}
			}
			//辨别其他字符token
			else if (letter.indexOf(b) > -1) {
				token.type = tokenType.USERWORD;
				if (alnum.indexOf(nb) > -1){
					for (i++; i < contentLen; i++) {
						nb = content.charAt(i+1);
						token.value += content.charAt(i);
						if (alnum.indexOf(nb) < 0){
							//辨别关键字
							if(keyword[token.value]){
								if(token.value=="true" || token.value=="false" || token.value=="null")
									token.type = tokenType.NUMBER;
								else
									token.type = tokenType.KEYWORD;
							}
							break;
						}
					}
				}
			}
			else {
				throwError(token, "24");
			}
			//处理lamda表达式
			if (token.value == '->') {
				lamdaStatus = lamdaStatusType.start;
				if(prevToken.value == ')'){
					var tempTokens = [],tempToken = {};
					prevToken = tokens.pop();
					tempTokens.push(prevToken);
					do {
						tempToken = tokens.pop();
						if ((tempToken.type != tokenType.USERWORD && tempToken.value != ',' && tempToken.value != '(')||
							(prevToken.type == tokenType.USERWORD && (tempToken.value!=',' && tempToken.value!='('))||
							((prevToken.value == ',' || prevToken.value == ')') && tempToken.type != tokenType.USERWORD)) {
							throwError(token, "24");
						}
						tempTokens.push(tempToken);
						prevToken = tempToken;
					} while(tempToken && tempToken.value!='(')

					tokens.push({value:'function', type:tokenType.KEYWORD,line:lineNo});
					for(var j = tempTokens.length-1; j >= 0; j--){
						tokens.push(tempTokens[j]);
					}
				}
				else if(prevToken.type == tokenType.USERWORD){
					tokens.pop();
					tokens.push({value:'function', type:tokenType.KEYWORD,line:lineNo});
					tokens.push({value:'(', type:tokenType.SIGN,line:lineNo});
					tokens.push(prevToken);
					tokens.push({value:')', type:tokenType.SIGN,line:lineNo});
				}
				else{
					throwError(token, "24");
				}
			} else if(lamdaStatus == lamdaStatusType.start){
				if(token.value == '{'){
					tokens.push(token);
					lamdaStatus = lamdaStatusType.close;
				} else {
					tokens.push({value:'{', type:tokenType.SIGN,line:lineNo});
					if (token.value != 'return')
						tokens.push({value:'return', type:tokenType.KEYWORD,line:lineNo});
					tokens.push(token);
					lamdaStatus = lamdaStatusType.single;
				}
			} else if(lamdaStatus == lamdaStatusType.single){
				tokens.push(token);
				if(token.value == ';'){
					lamdaStatus = lamdaStatusType.close;
					tokens.push({value:'}', type:tokenType.SIGN,line:lineNo});
				}
			} else {
				tokens.push(token);
			}
			prevToken = token;
		}

		if(signQ.length > 0)
			throwError(token, "24");
		return tokens;
	}

	//根据token，生成对象树
	function parser(tokens){
		var status={DEFAULT:0,DECLARE_PACKAGE:1,DEFINE_PACKAGE:2,DECLARE_IMPORT:3,DEFINE_IMPORT:4,DECLARE_CLASS:5,
			DEFINE_CLASS:6,DECLARE_EXTENDS_CLASS:7,DEFINE_EXTENDS_CLASS:8,CLASS:9,DECLARE_MODIFIER_SCOPE:10,
			DECLARE_MODIFIER_STATIC:11,DEFINE_PROPERTY:12,PROPERTY:13,DECLARE_FUNCTION:14,DEFINE_FUNCTION:15,
			DEFINE_FUNCTION_PARAM:16,DEFINE_FUNCTION_PARAM_VALUE:17,DEFINE_FUNCTION_VARIABLE_PARAM:18,BEGIN_FUNCTION:19,FUNCTION:20};
		var scope = scopeType.DEFAULT, isStatic = false, package = null, importPath = null, current_status = status.DEFAULT;
		var imports = classObj = memberObj = paramObj = {};
		var token, prevToken, signQ = [];

		var newClass = function (token){
			var name = token.value;
			var fullName = package ? package + "." + name : name;
			if(classes[fullName]){
				throwError(token, "22");
			}
			classObj = {package:package, name:name, imports:imports, parent:null, members:{}};
			classes[fullName] = classObj;
		}

		var newMember = function (token, scope, isStatic, type){
			if (type == memberType.FUNCTION) {
				memberObj = {name:token.value, params:[], body:[], isStatic:isStatic, scope:scope, type:type, isConstructor:false, isVariable:false, hasDefault:false};
			}else if(type == memberType.PROPERTY){
				memberObj = {name:token.value, body:[], isStatic:isStatic, scope:scope, type:type};
			}
		}

		var newParam = function (token){
			paramObj = {name:token.value, hasDefault:false, value:null,isVariable:false};
		}

		var pushMember = function (token){
			if(memberObj.name == classObj.name && memberObj.type == memberType.FUNCTION && !memberObj.isStatic){
				memberObj.isConstructor = true;
			}
			if (classObj.members[memberObj.name]) {
				throwError(token,"22");
			}
			classObj.members[memberObj.name] = memberObj;
		}

		var pushParam = function(token){
			if(memberObj.params.length>0){
				var lastParam = memberObj.params[memberObj.params.length - 1];
				if(lastParam.hasDefault && !paramObj.hasDefault){
					throwError(token,"222");
				} else if(lastParam.isVariable){
					throwError(token,"223");
				} else if(paramObj.isVariable && memberObj.hasDefault){
					throwError(token,"224");
				}
				for(var i=0;i<memberObj.params.length;i++){
					if(memberObj.params[i].name == paramObj.name){
						throwError(token,"221");
					}
				}
			}
			memberObj.hasDefault = paramObj.hasDefault;
			memberObj.isVariable = paramObj.isVariable;
			memberObj.params.push(paramObj);
		}

		for(var i = 0; i< tokens.length; i++){
			token = tokens[i];
			switch (token.value) {
				case 'package':
					if (i > 0) {
						throwError(token, "1");
					}
					current_status = status.DECLARE_PACKAGE;
					break;
				case 'import':
					if (current_status == status.DEFAULT) {
						current_status = status.DECLARE_IMPORT;
						break;
					}
					throwError(token, "2");
				case 'class':
					if (current_status == status.DEFAULT) {
						current_status = status.DECLARE_CLASS;
						break;
					}
					throwError(token, "3");
				case 'extends':
					if (current_status == status.DEFINE_CLASS) {
						current_status = status.DECLARE_EXTENDS_CLASS;
						break;
					}
					throwError(token, "4");
				case 'private':
					if (current_status == status.CLASS) {
						scope = scopeType.PRIVATE;
						current_status = status.DECLARE_MODIFIER_SCOPE;
						break;
					}
					throwError(token, "5a");
				case 'public':
					if (current_status == status.CLASS) {
						scope = scopeType.PUBLIC;
						current_status = status.DECLARE_MODIFIER_SCOPE;
						break;
					}
					throwError(token, "5b");
				case 'protected':
					if (current_status == status.CLASS) {
						scope = scopeType.PROTECTED;
						current_status = status.DECLARE_MODIFIER_SCOPE;
						break;
					}
					throwError(token, "5c");
				case 'static':
					if (current_status == status.CLASS || current_status == status.DECLARE_MODIFIER_SCOPE) {
						isStatic = true;
						current_status = status.DECLARE_MODIFIER_STATIC;
						break;
					}
					throwError(token, "7");
				case 'function':
					if (current_status == status.CLASS||current_status == status.DECLARE_MODIFIER_SCOPE||current_status == status.DECLARE_MODIFIER_STATIC) {
						if(current_status == status.DECLARE_MODIFIER_SCOPE && prevToken.value=='var')
							throwError(token, "7");
						current_status = status.DECLARE_FUNCTION;
						break;
					}
				case 'var':
					if (current_status == status.CLASS) {
						scope = scopeType.PRIVATE;
						current_status = status.DECLARE_MODIFIER_SCOPE;
						break;
					}
				default:
					switch(current_status) {
						case status.DECLARE_PACKAGE:
							if(token.type == tokenType.USERWORD) {
								package = token.value;
								current_status = status.DEFINE_PACKAGE;
								break;
							}
							throwError(token, "8");
						case status.DEFINE_PACKAGE:
							if ((prevToken.type == tokenType.USERWORD && token.value == '.') || (token.type == tokenType.USERWORD && prevToken.value == '.')) {
								package += token.value;
								break;
							}
							else if(prevToken.type == tokenType.USERWORD && token.value == ';') {
								current_status = status.DEFAULT;
								break;
							} 
							throwError(token, "9");
						case status.DECLARE_IMPORT:
							if(token.type == tokenType.USERWORD){
								importPath = token.value;
								current_status = status.DEFINE_IMPORT;
								break;
							}
							throwError(token, "9a");
						case status.DEFINE_IMPORT:
							if ((prevToken.type == tokenType.USERWORD && token.value == '.') || (token.type == tokenType.USERWORD && prevToken.value == '.')) {
								importPath += token.value;
								break;
							}
							else if(prevToken.type == tokenType.USERWORD && token.value == ';') {
								imports[prevToken.value] = importPath;
								current_status = status.DEFAULT;
								break;
							} 
							throwError(token, "9b");
						case status.DECLARE_CLASS:
							if (token.type == tokenType.USERWORD) {
								newClass(token);
								current_status = status.DEFINE_CLASS;
								break;
							} 
							throwError(token, "10");
						case status.DEFINE_CLASS:
							if (token.value=="{") {
								current_status = status.CLASS;
								break;
							} 
							throwError(token, "11");
						case status.DECLARE_EXTENDS_CLASS:
							if (token.type == tokenType.USERWORD) {
								classObj.parent = token.value;
								current_status = status.DEFINE_EXTENDS_CLASS;
								break;
							} 
							throwError(token, "12");
						case status.DEFINE_EXTENDS_CLASS:
							if ((prevToken.type == tokenType.USERWORD && token.value == '.') || (token.type == tokenType.USERWORD && prevToken.value == '.')) {
								classObj.parent += token.value;
								break;
							}
							else if(prevToken.type == tokenType.USERWORD && token.value == '{') {
								current_status = status.CLASS;
								break;
							} 
							throwError(token, "13");
						case status.DECLARE_MODIFIER_SCOPE:
							if (token.type == tokenType.USERWORD) {
								newMember(token,scope,false,memberType.PROPERTY);
								scope=scopeType.DEFAULT;
								current_status = status.DEFINE_PROPERTY;
								break;
							}
							throwError(token, "14");
						case status.DECLARE_MODIFIER_STATIC:
							if (token.type == tokenType.USERWORD) {
								newMember(token,scope,isStatic,memberType.PROPERTY);
								scope=scopeType.DEFAULT;
								isStatic=false;
								current_status = status.DEFINE_PROPERTY;
								break;
							}
							throwError(token, "15");
						case status.DEFINE_PROPERTY:
							if(token.value == '=') {
								current_status = status.PROPERTY;
								break;
							} else if(token.value == ';'){
								current_status = status.CLASS;
								pushMember(token);
								break;
							} else if(token.value==','){
								current_status = status.DECLARE_MODIFIER_STATIC;
								scope = memberObj.scope;
								isStatic = memberObj.isStatic;
								pushMember(token);
								break;
							}
							throwError(token, "16");
						case status.PROPERTY:
							if(memberObj.body.length == 0 && token.value == 'function'){
								memberObj.type = memberType.FUNCTION;
								memberObj.params = [];
								current_status = status.DEFINE_FUNCTION;
								break;
							}
							if(token.type == tokenType.SIGN) symbolMatch(token, signQ);
							if(signQ.length == 0 && (token.value == ';' || token.value == '}' || token.value ==',')){
								current_status = status.CLASS;
								pushMember(token);
								if(token.value==';'){
									break;
								}
								if(token.value==','){
									current_status = status.DECLARE_MODIFIER_STATIC;
									scope = memberObj.scope;
									isStatic = memberObj.isStatic;
									break;
								}
							}
							if(token.type == tokenType.KEYWORD){
								throwError(token, "16");
							}
							memberObj.body.push(token);
							break;
						case status.DECLARE_FUNCTION:
							if (token.type == tokenType.USERWORD) {
								current_status = status.DEFINE_FUNCTION;
								newMember(token,scope,isStatic,memberType.FUNCTION);
								isStatic = false;
								scope = scopeType.DEFAULT;
								break;
							}
							throwError(token, "17a");
						case status.DEFINE_FUNCTION:
							if (token.value == '(') {
								current_status = status.DEFINE_FUNCTION_PARAM;
								break;
							}
							throwError(token, "17b");
						case status.DEFINE_FUNCTION_PARAM:
							if(token.value == ')' && (prevToken.value=='('||prevToken.type==tokenType.USERWORD)) {
								current_status = status.BEGIN_FUNCTION;
								pushParam(token);
								break;
							}else if(token.type==tokenType.USERWORD && (prevToken.value=='(' || prevToken.value==',')){
								newParam(token);
								break;
							} else if(token.value == '=' && prevToken.type == tokenType.USERWORD){
								current_status = status.DEFINE_FUNCTION_PARAM_VALUE;
								break;
							} else if(token.value == '...' && prevToken.type == tokenType.USERWORD){
								current_status = status.DEFINE_FUNCTION_VARIABLE_PARAM;
								break;
							} else if(token.value == ',' && prevToken.type == tokenType.USERWORD){
								pushParam(token);
								break;
							}
							throwError(token, "18");
						case status.DEFINE_FUNCTION_PARAM_VALUE:
							if(prevToken.value == '=' && (token.type == tokenType.NUMBER || token.type == tokenType.STRING)){
								paramObj.hasDefault = true;
								paramObj.value = token.value;
								pushParam(token);
								break;
							} else if(token.value == ',' && (prevToken.type == tokenType.NUMBER || prevToken.type == tokenType.STRING)){
								current_status = status.DEFINE_FUNCTION_PARAM;
								break;
							} else if(token.value == ')' && (prevToken.type == tokenType.NUMBER || prevToken.type == tokenType.STRING)){
								current_status = status.BEGIN_FUNCTION;
								break;
							}
							throwError(token, "18");
						case status.DEFINE_FUNCTION_VARIABLE_PARAM:
							if(token.value==")" && prevToken.value=="..."){
								paramObj.isVariable = true;
								pushParam(token);
								current_status = status.BEGIN_FUNCTION;
								break;
							}
							throwError(token, "18");
						case status.BEGIN_FUNCTION:
							if(token.value =="{"){
								if(signQ.length == 0){
									symbolMatch(token, signQ);
								}else{
									throwError(token, "18s");
								}
								memberObj.body.push(token);
								current_status = status.FUNCTION;
								break;
							}
							throwError(token, "18d");
						case status.FUNCTION:
							if(token.type == tokenType.SIGN) symbolMatch(token, signQ);
							memberObj.body.push(token);
							if(signQ.length == 0){
								current_status = status.CLASS;
								pushMember(token);
							}
							break;
						case status.CLASS:
							if(token.value=='}'){
								current_status = status.DEFAULT;
								break;
							}
							throwError(token, "19");
						default:
							throwError(token, "99");
							break;
					}
			}
			prevToken = token;
		}
		return classes;
	}
	
	function generator(classes){
		var br = "\r\n", tab = "\t",space = ' ',self = "public", ower = "private";
		var s = [];
		s.push('(','function','(',')','{');
		
		function linkWord(classObj, token){
			if (classObj.imports[token]){
				return classObj.imports[token];
			} else if (classes[classObj.package + "." + token]){
				return classObj.package + "." + token;
			}
			return token;
		}

		function compileBody(classObj, member){
			var tokens = member.body;
			var r = [], token = {}, s = 0;
			if(member.type == memberType.FUNCTION){
				s = 1;
				r.push('function','(');
				if(member.hasDefault || member.isVariable){
					r.push(')','{');
					var argument = member.isConstructor ? "_arguments" : "arguments";
					for (var i=0;i<member.params.length;i++){
						var param = member.params[i];
						r.push('var',space,param.name,'=',argument);
						if(!param.hasDefault && !param.isVariable){
							r.push('[',i,']',';');
						} else if(param.hasDefault){
							r.push('[',i,']','?',argument,'[',i,']',':',param.value,';');
						} else{
							r.push('.','slice','(',i,')',';');
						}
					}
				}
				else{
					for (var i=0;i<member.params.length;i++){
						r.push(member.params[i].name);
						if(i<member.params.length-1){
							r.push(',');
						}
					}
					r.push(')','{');
				}
			}

			for(var i = s; i < tokens.length; i++){
				token = tokens[i];
				if (token.value == "this" && !member.isStatic){
					if(i<tokens.length-2 && tokens[i+1].value == "." && tokens[i+2].type == tokenType.USERWORD 
					&& classObj.members[tokens[i+2].value]){
						var nextmember = classObj.members[tokens[i+2].value];
						if (nextmember.isStatic){
							throwError("19");
						}
						if (nextmember.scope == scopeType.PRIVATE) {
							token.value = ower;
						} else {
							token.value = self;
						}
					}
				}
				if (token.type == tokenType.USERWORD  && ((tokens[i-1] && tokens[i-1].value == "new")||
					((!tokens[i-1] || tokens[i-1].value != ".") && (tokens[i+1] && tokens[i+1].value == ".")))){
					token.value = linkWord(classObj, token.value);
				}

				r.push(token.value);
				if(token.type == tokenType.KEYWORD && tokens[i+1] && tokens[i+1].type != tokenType.SIGN){
					r.push(" ");
				}
			}
			
			return r.join("");
		}

		for (var className in classes){
			var classObj = classes[className];
			var hasConstructor = false, statics = [],members = [];
			if(classObj.package && classObj.package.length > 0){
				var package = "", p = "", arr = classObj.package.split(".");
				for(var i=0;i<arr.length;i++){
					p += (i==0 ? "" : ".") + arr[i];
					package += "if (typeof(" + p + ") == \"undefined\") " + p + " = {};" ;
				}
				s.push(package);
			}

			for(var memberName in classObj.members){
				var member = classObj.members[memberName];
				if (member.isConstructor){
					var r = "(" + compileBody(classObj, member)+ "(";
					if(member.hasDefault || member.isVariable){
						r = "var _arguments=arguments;" + r;
					}
					else{
						for (var i=0;i<member.params.length;i++){
							r+="arguments["+i+"]";
							if(i<member.params.length-1){
								r+=',';
							}
						}
					}
					r += "));";
					members.push(r);
				}
				else if (!member.isStatic && member.type == memberType.FUNCTION && member.scope == scopeType.PRIVATE) {
					members.push(ower + "." + memberName + " = " + compileBody(classObj, member)+ ";");
				}
				else if (!member.isStatic && member.type == memberType.PROPERTY && member.scope == scopeType.PRIVATE) {
					members.push(ower + "." + memberName + (member.body.length==0 ? "" : " = " + compileBody(classObj, member)) + ";");
				}
				else if (!member.isStatic && member.type == memberType.FUNCTION && member.scope == scopeType.PUBLIC) {
					members.push(self + "." + memberName + " = " + compileBody(classObj, member)+ ";");
				}
				else if (!member.isStatic && member.type == memberType.PROPERTY && member.scope == scopeType.PUBLIC) {
					members.push(self + "." + memberName + (member.body.length==0 ? "" : " = " + compileBody(classObj, member)) + ";");
				}
				else if (member.isStatic && member.type == memberType.FUNCTION) {
					statics.push(classObj.name + "." + memberName + " = " + compileBody(classObj, member)+ ";");
				}
				else if (member.isStatic && member.type == memberType.PROPERTY) {
					statics.push(classObj.name + "." + memberName + (member.body.length==0 ? "" : " = " + compileBody(classObj, member)) + ";");
				}
			}

			s.push('var', space, classObj.name, '=',"function",'(',')','{');
			s.push('var',space,self,'=');
			var parent = classObj.parent;
			if (parent) {
				if(parent.indexOf('.') < 0){
					parent = linkWord(classObj, parent);
				}
				s.push('new',space,parent,'(',')',';');
			} else {
				s.push('this',';');
			}
			s.push('var',space,ower,'=','{','}',';');
			s = s.concat(members);
			s.push('return',space,self,';');
			s.push('}',';');
			s = s.concat(statics);
			s.push(className, "=", classObj.name, ";");
		}
		s.push('}','(',')',')',';');
		
		document.write('<pre>'+format(s.join(''))+"</pre>");
		return s;
	}

	function format(content){
		var s = [];
		var sLen=0;
		var isNewLine = false;
		for (i = 0; i < content.length; i++) {
			var b = content.charAt(i), nb =(i+1 < content.length)? content.charAt(i+1):'';
			if(b=='{')sLen++;
			if(b=='}')sLen--;
			if(isNewLine){
				for(var j=0;j<sLen;j++)
					s.push("\t");
				isNewLine = false;
			}
			s.push(b);
			if (b==';'||(b=='{' && nb!='}')|| (b=='}' && nb!=';' && nb!='('&& nb!=')')){
				s.push("\r\n");
				isNewLine = true;
			}
		}
		return s.join('');
	}

packObj.scanner = scanner;
packObj.parser = parser;
packObj.generator = generator;
}(OBJECTJS));